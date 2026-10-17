import "server-only";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ContentFilterFinishReasonError, LengthFinishReasonError } from "openai/core/error";
import type { z } from "zod";

// Every AI feature goes through runStructured(): the model answers in a fixed JSON
// shape (structured outputs), so the UI never renders free-form model text as HTML.

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

export type AiResult<T> = { ok: true; data: T; model: string } | { ok: false; error: string };

export const aiConfigured = () => Boolean(process.env.OPENAI_API_KEY);

let client: OpenAI | null = null;
function getClient() {
  client ??= new OpenAI({ timeout: 60_000, maxRetries: 1 });
  return client;
}

export async function runStructured<S extends z.ZodType>(opts: {
  system: string;
  input: string;
  schema: S;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<AiResult<z.infer<S>>> {
  if (!aiConfigured()) return { ok: false, error: "AI features aren't switched on yet (no API key on the server)." };
  try {
    const completion = await getClient().chat.completions.parse({
      model: AI_MODEL,
      max_completion_tokens: opts.maxTokens ?? 8000,
      reasoning_effort: opts.effort ?? "medium",
      response_format: zodResponseFormat(opts.schema, "answer"),
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.input },
      ],
    });
    const message = completion.choices[0]?.message;
    if (message?.refusal) return { ok: false, error: "The AI declined to answer this one." };
    if (message?.parsed == null) return { ok: false, error: "The AI's answer came back incomplete. Try again." };
    return { ok: true, data: message.parsed as z.infer<S>, model: completion.model };
  } catch (error) {
    if (error instanceof LengthFinishReasonError) return { ok: false, error: "The AI's answer came back incomplete. Try again." };
    if (error instanceof ContentFilterFinishReasonError) return { ok: false, error: "The AI declined to answer this one." };
    if (error instanceof OpenAI.RateLimitError) return { ok: false, error: "The AI is busy right now. Try again in a minute." };
    if (error instanceof OpenAI.AuthenticationError) {
      console.error(`OpenAI API key rejected: ${error.message}`); // OpenAI masks the key in this message
      return { ok: false, error: "AI features are misconfigured on the server." };
    }
    if (error instanceof OpenAI.APIError) {
      console.error(`OpenAI API error ${error.status}: ${error.message}`);
      return { ok: false, error: "The AI service had a problem. Try again shortly." };
    }
    console.error("AI request failed", error);
    return { ok: false, error: "Couldn't reach the AI service. Try again shortly." };
  }
}
