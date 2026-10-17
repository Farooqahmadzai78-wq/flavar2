import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  checkAiRateLimit,
  extractClientKey,
  rateLimitError,
} from "./ai-rate-limit";
import { buildTtsProviderPayload, ttsSchema } from "./tts-validation";

export const getTtsAudio = createServerFn({ method: "GET" })
  .validator((data: unknown) => ttsSchema.parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();
    const decision = await checkAiRateLimit("tts", {
      request,
      key: extractClientKey(request?.headers),
    });
    if (!decision.allowed) throw rateLimitError("tts", decision.retryAfterSec);

    const { text, voice } = buildTtsProviderPayload(data);
    if (!text) throw new Error("Missing text");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: text,
        voice,
        instructions: "Speak calmly, warmly and reverently, at a measured pace.",
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      throw new Error("TTS error");
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:audio/mpeg;base64,${base64}`;
  });
