import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

// Every AI feature goes through runStructured(): Claude answers in a fixed JSON
// shape (structured outputs), so the UI never renders free-form model text as HTML.

export const AI_MODEL = "claude-opus-5-5";

export type AiResult<T> = { ok: true; data: T; model: string } | { ok: false; error: string };

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
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
    const response = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      // If Claude's safety classifiers decline, retry on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
      system: opts.system,
      messages: [{ role: "user", content: opts.input }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "The AI declined to answer this one." };
    if (response.stop_reason === "max_tokens" || response.parsed_output == null) {
      return { ok: false, error: "The AI's answer came back incomplete. Try again." };
    }
    return { ok: true, data: response.parsed_output as z.infer<S>, model: response.model };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, error: "The AI is busy right now. Try again in a minute." };
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic API key rejected");
      return { ok: false, error: "AI features are misconfigured on the server." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`);
      return { ok: false, error: "The AI service had a problem. Try again shortly." };
    }
    console.error("AI request failed", error);
    return { ok: false, error: "Couldn't reach the AI service. Try again shortly." };
  }
}
