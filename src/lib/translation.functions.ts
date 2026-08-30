import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

const translateSchema = z.object({
  text: z.string().min(1).max(5000),
  targetLang: z.string().min(2).max(10), // e.g. 'fr', 'en', 'ps', 'ar', 'ur', 'tr', 'de', 'es'
  sourceLang: z.string().max(10).optional(),
});

export type TranslateResult = {
  translatedText: string;
  sourceLang?: string;
  targetLang: string;
  success: boolean;
};

// In-memory server cache to avoid redundant API calls
const translationCache = new Map<string, string>();

export async function translateTextInternal(
  text: string,
  targetLang: string,
  sourceLang?: string,
): Promise<string> {
  if (!text || !text.trim()) return text;
  const cacheKey = `${sourceLang || "auto"}:${targetLang}:${text.trim()}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return text;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const prompt = `You are a professional, accurate translator.
Translate the following text faithfully and naturally into target language "${targetLang}".
Maintain the tone, intent, technical terms, and formatting.
Respond ONLY with the translated text without adding quotes, notes, or extra commentary.

Text to translate:
${text}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
    });

    const translated = response.text?.trim() || text;
    translationCache.set(cacheKey, translated);
    if (translationCache.size > 2000) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) translationCache.delete(firstKey);
    }
    return translated;
  } catch (err) {
    console.error("[Translation] Error in translateTextInternal:", err);
    return text;
  }
}

export const translateTextServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => translateSchema.parse(data))
  .handler(async ({ data }): Promise<TranslateResult> => {
    const { text, targetLang, sourceLang } = data;
    const translated = await translateTextInternal(text, targetLang, sourceLang);
    return {
      translatedText: translated,
      sourceLang,
      targetLang,
      success: translated !== text || !process.env.GEMINI_API_KEY,
    };
  });
