import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Caching and rate limits for AI requests (tables from migration 0006).
// If the tables don't exist yet, caching is skipped and rate limits fall back
// to this server instance's memory, so the features still work, just less cheaply.

export type Cached<T> = { content: T; createdAt: string };

export async function readCache<T>(key: string, maxAgeMs: number): Promise<Cached<T> | null> {
  const { data, error } = await createAdminClient()
    .from("ai_cache").select("content, created_at").eq("key", key).maybeSingle();
  if (error || !data) return null;
  if (Date.now() - Date.parse(data.created_at) > maxAgeMs) return null;
  return { content: data.content as T, createdAt: data.created_at };
}

export async function writeCache(key: string, kind: string, content: unknown, model: string): Promise<string> {
  const createdAt = new Date().toISOString();
  await createAdminClient().from("ai_cache").upsert({ key, kind, content, model, created_at: createdAt });
  return createdAt;
}

const memory = new Map<string, number[]>();

/** True if `subject` may make another `kind` request: at most `limit` per `windowMs`. Records the request when allowed. */
export async function allowRequest(kind: string, subject: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const admin = createAdminClient();
  const { count, error } = await admin.from("ai_usage")
    .select("id", { count: "exact", head: true }).eq("kind", kind).eq("subject", subject).gte("created_at", since);
  // A count-only request on a missing table reports no error, just a null count.
  if (!error && count !== null) {
    if (count >= limit) return false;
    const { error: insertError } = await admin.from("ai_usage").insert({ kind, subject });
    if (!insertError) return true;
  }
  const key = `${kind}:${subject}`;
  const recent = (memory.get(key) ?? []).filter((t) => t > Date.now() - windowMs);
  if (recent.length >= limit) return false;
  memory.set(key, [...recent, Date.now()]);
  return true;
}

/** One-way hash so rate limits can key on an IP address without storing it. */
export function hashSubject(value: string) {
  return createHash("sha256").update(`nightshift-ai:${value}`).digest("hex").slice(0, 32);
}

/** Short stable hash of the facts sent to the AI, so a cache entry is reused only for the same data. */
export function factsKey(facts: unknown) {
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex").slice(0, 16);
}
