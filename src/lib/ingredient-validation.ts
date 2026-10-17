import { z } from "zod";

/**
 * Strict access-token shape: exactly 64 lowercase hex characters (256 bits).
 * Matches `generateAccessToken()` output and `isValidAccessToken()` guard.
 */
export const accessTokenSchema = z
  .string()
  .length(64)
  .regex(/^[0-9a-f]+$/, "access token must be a 64-character lowercase hex string");

/**
 * Input contract for `analyzeIngredientsPhoto` (P1).
 *
 * `analysisId` and `accessToken` are REQUIRED. Previously they were optional,
 * which let a request that simply omitted `analysisId` reach the AI provider
 * (Gemini/Lovable) with no capability token. Making both mandatory closes that
 * quota-abuse bypass: an invalid or missing token is rejected before any AI
 * call is made.
 *
 * The token's exact 64-hex shape is enforced by `accessTokenSchema` in the
 * Zod input validator (runs before the handler), and re-checked by
 * `isValidAccessToken` in the handler as defense-in-depth.
 */
export const analyzeIngredientsSchema = z.object({
  /** data URL of the ingredient-list photo */
  image: z.string().min(32).max(8_000_000),
  lang: z.string().max(8).default("fr"),
  analysisId: z.string().min(1),
  accessToken: accessTokenSchema,
});

/**
 * Decision for the client status-poll loop (P2).
 *
 * - `unauthorized` -> `stop`: the server refuses the token for this job, so
 *   keep polling would be pointless; stop and fall back to the direct request.
 * - `completed` with a result -> `result`.
 * - `failed` -> `failed`.
 * - anything else (processing/pending/timeout) -> `continue`.
 */
export type PollAction = "result" | "failed" | "stop" | "continue";

export function decidePollAction(
  status: string | undefined,
  hasResult: boolean,
): PollAction {
  if (status === "unauthorized") return "stop";
  if (status === "failed") return "failed";
  if (status === "completed" && hasResult) return "result";
  return "continue";
}
