import {
  analyzeIngredientsPhoto,
  startIngredientAnalysisJob,
  getIngredientAnalysisJobStatus,
  type IngredientAnalysis,
} from "./ingredients.functions";
import { analyse, type ProductResult } from "./halal";

const STORAGE_KEY = "islam_noor_ingredient_analysis_active_v1";
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export interface PersistedAnalysisState {
  analysisId: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: number;
  product?: ProductResult;
  error?: string;
  progressMessage?: string;
}

/** Reads the currently active analysis from local storage */
export function getActiveIngredientAnalysis(): PersistedAnalysisState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAnalysisState;
    if (!parsed || !parsed.analysisId) return null;
    if (Date.now() - parsed.createdAt > MAX_AGE_MS) {
      clearActiveIngredientAnalysis();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Saves or updates the active analysis state in local storage */
export function saveActiveIngredientAnalysis(state: PersistedAnalysisState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota or serialization errors
  }
}

/** Clears any active analysis from storage */
export function clearActiveIngredientAnalysis() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Helper to convert AI analysis into a full ProductResult with 5 compliance checks */
export function formatAnalysisToProduct(
  analysis: IngredientAnalysis,
  fallbackTitle: string = "Ingrédients analysés",
): ProductResult {
  const rawProduct: Record<string, unknown> = {
    code: `photo-ai-${Date.now()}`,
    product_name: analysis.name?.trim() || fallbackTitle,
    brands: analysis.brand?.trim() || "Analyse IA & Vision",
    ingredients_text:
      analysis.ingredientsText?.trim() ||
      (analysis.reasons && analysis.reasons.length > 0 ? analysis.reasons.join(", ") : ""),
    nutriscore_grade: analysis.nutriscore,
    allergens_tags: analysis.allergens,
  };

  const analyzed = analyse(rawProduct, "Analyse IA Vision & Multi-Tests");

  // Keep the AI verdict if more specific or if direct AI detection found something
  const mergedVerdict =
    analysis.verdict === "haram"
      ? "haram"
      : analyzed.verdict === "haram"
        ? "haram"
        : analysis.verdict === "doubtful" || analyzed.verdict === "doubtful"
          ? "doubtful"
          : analysis.verdict === "halal"
            ? "halal"
            : analyzed.verdict;

  const combinedReasons = Array.from(
    new Set([...(analysis.reasons || []), ...analyzed.reasons]),
  );

  return {
    ...analyzed,
    verdict: mergedVerdict,
    reasons: combinedReasons,
  };
}

/**
 * Runs a resilient, background-safe ingredient analysis.
 * - Stores state in localStorage before network call.
 * - Starts server job tracking.
 * - Allows polling and recovery if page reloads.
 */
export async function runResilientIngredientAnalysis(
  imageDataUrl: string,
  options: {
    lang?: string;
    fallbackTitle?: string;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ProductResult> {
  const analysisId = `ing_analysis_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const lang = options.lang || "fr";

  // 1. Persist initial state
  const initialJob: PersistedAnalysisState = {
    analysisId,
    status: "processing",
    createdAt: Date.now(),
    progressMessage: "Analyse des ingrédients par l'IA en cours...",
  };
  saveActiveIngredientAnalysis(initialJob);
  options.onProgress?.("Envoi et analyse de l'image...");

  try {
    // 2. Start server-side asynchronous job
    try {
      await startIngredientAnalysisJob({
        data: {
          analysisId,
          image: imageDataUrl,
          lang,
        },
      });
    } catch (startErr) {
      console.warn("Could not start background job, falling back to direct server function:", startErr);
    }

    // 3. Simultaneously trigger direct analysis promise or poll
    const directPromise = analyzeIngredientsPhoto({
      data: {
        image: imageDataUrl,
        lang,
        analysisId,
      },
    });

    // 4. Race / poll for completion
    let attempts = 0;
    const maxAttempts = 35; // ~40 seconds timeout

    while (attempts < maxAttempts) {
      // Check server job status
      try {
        const check = await Promise.race([
          getIngredientAnalysisJobStatus({ data: { analysisId } }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1400)),
        ]);

        if (check && check.status === "completed" && check.result) {
          const product = formatAnalysisToProduct(check.result, options.fallbackTitle);
          saveActiveIngredientAnalysis({
            analysisId,
            status: "completed",
            createdAt: initialJob.createdAt,
            product,
          });
          return product;
        }

        if (check && check.status === "failed") {
          throw new Error(check.error || "L'analyse des ingrédients a échoué.");
        }
      } catch (pollErr) {
        console.debug("Status poll check:", pollErr);
      }

      // Check if directPromise has already finished
      const directResolved = await Promise.race([
        directPromise.then((res) => ({ ok: true as const, res })),
        new Promise<{ ok: false }>((resolve) => setTimeout(() => resolve({ ok: false }), 200)),
      ]);

      if (directResolved.ok && directResolved.res) {
        const product = formatAnalysisToProduct(directResolved.res, options.fallbackTitle);
        saveActiveIngredientAnalysis({
          analysisId,
          status: "completed",
          createdAt: initialJob.createdAt,
          product,
        });
        return product;
      }

      attempts++;
      await new Promise((r) => setTimeout(r, 1000));
    }

    // If polling timed out, try awaiting directPromise one last time
    const directResult = await directPromise;
    const product = formatAnalysisToProduct(directResult, options.fallbackTitle);
    saveActiveIngredientAnalysis({
      analysisId,
      status: "completed",
      createdAt: initialJob.createdAt,
      product,
    });
    return product;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erreur pendant l'analyse des ingrédients";
    saveActiveIngredientAnalysis({
      analysisId,
      status: "failed",
      createdAt: initialJob.createdAt,
      error: errorMsg,
    });
    throw err;
  }
}

/**
 * Recovers an ongoing or completed analysis from local storage if the app was reloaded.
 */
export async function recoverActiveAnalysis(
  fallbackTitle: string = "Ingrédients analysés",
): Promise<{
  active: boolean;
  status?: "processing" | "completed" | "failed";
  product?: ProductResult;
  error?: string;
}> {
  const current = getActiveIngredientAnalysis();
  if (!current) return { active: false };

  // If already completed in local storage
  if (current.status === "completed" && current.product) {
    clearActiveIngredientAnalysis();
    return { active: true, status: "completed", product: current.product };
  }

  // If failed
  if (current.status === "failed") {
    clearActiveIngredientAnalysis();
    return { active: true, status: "failed", error: current.error };
  }

  // If currently processing, query server status
  try {
    const check = await getIngredientAnalysisJobStatus({ data: { analysisId: current.analysisId } });
    if (check.status === "completed" && check.result) {
      const product = formatAnalysisToProduct(check.result, fallbackTitle);
      clearActiveIngredientAnalysis();
      return { active: true, status: "completed", product };
    }
    if (check.status === "failed") {
      clearActiveIngredientAnalysis();
      return { active: true, status: "failed", error: check.error || "Analyse interrompue" };
    }
    return { active: true, status: "processing" };
  } catch {
    return { active: true, status: "processing" };
  }
}
