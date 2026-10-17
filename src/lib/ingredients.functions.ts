import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import {
  checkAiRateLimit,
  extractClientKey,
  rateLimitError,
} from "./ai-rate-limit";
import {
  accessTokenHashesMatch,
  canTransition,
  evaluateTokenBinding,
  hashAccessToken,
  isValidAccessToken,
} from "./ingredient-job-security";
import { analyzeIngredientsSchema, accessTokenSchema } from "./ingredient-validation";

export type IngredientAnalysis = {
  name: string;
  brand?: string;
  verdict: "halal" | "haram" | "doubtful" | "unknown";
  reasons: string[];
  ingredientsText?: string;
  nutriscore?: string;
  novaGroup?: number;
  ecoscore?: string;
  allergens?: string[];
};

type AnalysisJob = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: IngredientAnalysis;
  error?: string;
  createdAt: number;
  updatedAt: number;
  /** SHA-256 hash of the access token. The raw token is never stored. */
  tokenHash?: string;
};

// Global in-memory job store on the server
const serverAnalysisJobs = new Map<string, AnalysisJob>();

function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of serverAnalysisJobs.entries()) {
    if (now - job.createdAt > 15 * 60 * 1000) {
      serverAnalysisJobs.delete(id);
    }
  }
}

/**
 * Binds an incoming access token to a job. Returns the existing job when one is
 * already present, `undefined` when none exists yet, or `null` on a token
 * conflict (job bound to a different token) — in which case the job is left
 * untouched. The first caller establishes the association; later callers with
 * the same token keep it; a different token is rejected without side effects.
 */
async function bindJobToken(
  analysisId: string,
  accessToken: string,
): Promise<AnalysisJob | undefined | null> {
  const incomingHash = await hashAccessToken(accessToken);
  const existing = serverAnalysisJobs.get(analysisId);
  if (existing) {
    const decision = evaluateTokenBinding(existing.tokenHash, incomingHash);
    if (decision === "conflict") return null;
    if (decision === "establish") existing.tokenHash = incomingHash;
    return existing;
  }
  return undefined;
}

/** Creates a fresh job entry bound to the token hash. */
function createJob(analysisId: string, tokenHash: string): AnalysisJob {
  const now = Date.now();
  const job: AnalysisJob = {
    id: analysisId,
    status: "processing",
    tokenHash,
    createdAt: now,
    updatedAt: now,
  };
  serverAnalysisJobs.set(analysisId, job);
  return job;
}

/**
 * Applies a terminal transition (completed/failed) while preserving the token
 * binding and respecting terminal-state immutability (a late update never
 * replaces an already-finished result).
 */
function finalizeJob(
  analysisId: string,
  next: "completed" | "failed",
  patch: { result?: IngredientAnalysis; error?: string },
): void {
  const job = serverAnalysisJobs.get(analysisId);
  if (!job) return;
  if (!canTransition(job.status, next)) return;
  job.status = next;
  job.updatedAt = Date.now();
  if (next === "completed") job.result = patch.result;
  if (next === "failed") job.error = patch.error;
}

async function performAiIngredientAnalysis(image: string, lang: string): Promise<IngredientAnalysis> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;

  const systemInstruction =
    "You are an expert Islamic food compliance analyzer. Your task is to accurately read and analyze the ingredient list shown in the photo.\n\n" +
    "STRICT CLASSIFICATION RULES:\n" +
    "1. 'haram' (NON CONFORME):\n" +
    "   Assign ONLY when there is clear and indisputable evidence of an explicitly forbidden ingredient present in the ingredients:\n" +
    "   - Pork or porcine derivatives (porc, pork, lard, saindoux, bacon, jambon, gélatine de porc, pork gelatin).\n" +
    "   - Intoxicating alcohol/spirits added as beverage/flavor (vin/wine, bière/beer, rhum/rum, vodka, whisky, liqueur).\n" +
    "   - Carmine / Cochineal dye (E120, carmin, cochenille, acide carminique).\n" +
    "   - E441 or E542 from porcine/bone origin.\n" +
    "   CRITICAL NEGATION RULE: Phrases like 'sans porc', 'sans alcool', 'non-alcoholic', 'alcohol-free', '0.0% vol', 'vinaigre de vin', 'vinaigre d'alcool', 'gélatine végétale', 'certifié halal' are PERMISSIBLE and must NEVER be flagged as haram!\n\n" +
    "2. 'meat' & PERMISSIBLE MEATS (beef, chicken, turkey, lamb, veal):\n" +
    "   - If permissible meat is present AND officially halal certified (e.g. AVS, Achahada, Halal Certified) -> 'halal'.\n" +
    "   - If permissible meat is present WITHOUT clear halal certification visible -> 'doubtful' (Reason: 'La viande a été identifiée, mais aucune mention de certification halal n'est visible. Vérifiez la certification du produit.'). NEVER default uncertified meat to 'halal' or 'haram'!\n\n" +
    "3. 'halal' (CONFORME):\n" +
    "   Assign when all visible ingredients are permissible, plant-based, dairy, fish/seafood, mineral, or officially halal-certified, with no forbidden, doubtful, or uncertified meat items.\n\n" +
    "4. 'doubtful' (À VÉRIFIER):\n" +
    "   Assign when ingredients contain uncertified permissible meat, ambiguous dual-origin additives without specified plant source (e.g. unspecified 'gélatine', E471/E472 without 'origine végétale', 'présure animale', E904 shellac, E920 L-cystéine, or when text is partially cutoff/ambiguous).\n\n" +
    "5. 'unknown' (INDÉTERMINÉ):\n" +
    "   Assign when the image does not contain readable ingredient text (blurry image, no text).\n\n" +
    "MANDATORY GUIDELINES:\n" +
    "- NEVER invent ingredients or certifications not visible in the photo.\n" +
    "- NEVER turn uncertainty or missing information into 'haram'. Uncertainty MUST be 'doubtful' or 'unknown'.\n" +
    `- Answer strictly as JSON: {"name":string,"brand":string,"verdict":"halal"|"haram"|"doubtful"|"unknown","reasons":string[],"ingredientsText":string,"allergens":string[],"nutriscore":"a"|"b"|"c"|"d"|"e"}.\n` +
    `- Write "name", "brand", "reasons", and "ingredientsText" in language "${lang}". If haram, state "Ingrédient interdit identifié : [Nom]". If doubtful, state "Vérification nécessaire : [Raison]". Max 4 clear reasons.`;

  if (geminiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const matches = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    const mimeType = matches ? matches[1] : "image/jpeg";
    const base64Data = matches ? matches[2] : image;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: systemInstruction + "\nAnalyse cette photo d'ingrédients de manière fiable et rigoureuse." },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
    });

    const raw = response.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { name: "", verdict: "unknown", reasons: [] };

    const parsed = JSON.parse(match[0]) as Partial<IngredientAnalysis>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      brand: typeof parsed.brand === "string" ? parsed.brand : undefined,
      verdict:
        parsed.verdict === "halal" || parsed.verdict === "haram" || parsed.verdict === "doubtful"
          ? parsed.verdict
          : "unknown",
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 5).map(String) : [],
      ingredientsText: typeof parsed.ingredientsText === "string" ? parsed.ingredientsText : undefined,
      nutriscore: typeof parsed.nutriscore === "string" ? parsed.nutriscore.toLowerCase() : undefined,
      allergens: Array.isArray(parsed.allergens) ? parsed.allergens.map(String) : undefined,
    };
  }

  if (!lovableKey) throw new Error("AI unavailable");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${lovableKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: systemInstruction,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyse cette photo d'ingrédients de manière fiable et rigoureuse." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`AI request failed [${res.status}]: ${await res.text()}`);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { name: "", verdict: "unknown", reasons: [] };

  const parsed = JSON.parse(match[0]) as Partial<IngredientAnalysis>;
  return {
    name: typeof parsed.name === "string" ? parsed.name : "",
    brand: typeof parsed.brand === "string" ? parsed.brand : undefined,
    verdict:
      parsed.verdict === "halal" || parsed.verdict === "haram" || parsed.verdict === "doubtful"
        ? parsed.verdict
        : "unknown",
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 5).map(String) : [],
    ingredientsText: typeof parsed.ingredientsText === "string" ? parsed.ingredientsText : undefined,
    nutriscore: typeof parsed.nutriscore === "string" ? parsed.nutriscore.toLowerCase() : undefined,
    allergens: Array.isArray(parsed.allergens) ? parsed.allergens.map(String) : undefined,
  };
}

/** Reads a photo of an ingredient list and returns a halal verdict directly. */
export const analyzeIngredientsPhoto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => analyzeIngredientsSchema.parse(d))
  .handler(async ({ data }): Promise<IngredientAnalysis> => {
    const request = getRequest();
    const decision = await checkAiRateLimit("ingredientAnalyze", {
      request,
      key: extractClientKey(request?.headers),
    });
    if (!decision.allowed) throw rateLimitError("ingredientAnalyze", decision.retryAfterSec);

    cleanupExpiredJobs();

    // P1: analysisId + accessToken are mandatory and validated BEFORE any AI
    // call, so the quota cannot be consumed by an unauthenticated request.
    if (!isValidAccessToken(data.accessToken)) {
      throw new Error("Unauthorized");
    }

    const bind = await bindJobToken(data.analysisId, data.accessToken);
    if (bind === null) throw new Error("Unauthorized");
    if (!bind) createJob(data.analysisId, await hashAccessToken(data.accessToken));

    try {
      const result = await performAiIngredientAnalysis(data.image, data.lang);

      finalizeJob(data.analysisId, "completed", { result });

      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      finalizeJob(data.analysisId, "failed", { error: errMsg });
      throw err;
    }
  });

/** Starts an asynchronous persistent analysis job on the server */
export const startIngredientAnalysisJob = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        analysisId: z.string().min(1),
        image: z.string().min(32).max(8_000_000),
        lang: z.string().max(8).default("fr"),
        accessToken: accessTokenSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const decision = await checkAiRateLimit("ingredientStart", {
      request,
      key: extractClientKey(request?.headers),
    });
    if (!decision.allowed) throw rateLimitError("ingredientStart", decision.retryAfterSec);

    cleanupExpiredJobs();

    if (!isValidAccessToken(data.accessToken)) {
      throw new Error("Unauthorized");
    }

    // Establish or verify the token<->job binding. A different token on an
    // existing job is rejected without touching that job's data.
    const bind = await bindJobToken(data.analysisId, data.accessToken);
    if (bind === null) throw new Error("Unauthorized");

    if (bind) {
      // Job already exists and is bound to this token: never overwrite it.
      return { analysisId: data.analysisId, status: bind.status };
    }

    createJob(data.analysisId, await hashAccessToken(data.accessToken));

    // Run in background on server
    void performAiIngredientAnalysis(data.image, data.lang)
      .then((result) => {
        finalizeJob(data.analysisId, "completed", { result });
      })
      .catch((err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        finalizeJob(data.analysisId, "failed", { error: errMsg });
      });

    return { analysisId: data.analysisId, status: "processing" as const };
  });

/** Returns the status and result of a persistent analysis job */
export const getIngredientAnalysisJobStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        analysisId: z.string().min(1),
        accessToken: accessTokenSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const decision = await checkAiRateLimit("ingredientStatus", {
      request,
      key: extractClientKey(request?.headers),
    });
    if (!decision.allowed) throw rateLimitError("ingredientStatus", decision.retryAfterSec);

    cleanupExpiredJobs();

    const job = serverAnalysisJobs.get(data.analysisId);
    // Generic response for "missing" and "wrong token" alike, so an attacker
    // cannot tell whether an analysisId exists or belongs to someone else.
    if (!job || !job.tokenHash || !isValidAccessToken(data.accessToken)) {
      return { analysisId: data.analysisId, status: "unauthorized" as const };
    }

    const incomingHash = await hashAccessToken(data.accessToken);
    if (!accessTokenHashesMatch(job.tokenHash, incomingHash)) {
      return { analysisId: data.analysisId, status: "unauthorized" as const };
    }

    return {
      analysisId: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
    };
  });
