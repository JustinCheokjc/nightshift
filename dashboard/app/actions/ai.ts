"use server";

import { headers } from "next/headers";
import { getProfile, requireAdmin, requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { loadDevicesData } from "@/lib/devicesData";
import { loadFleet } from "@/lib/fleet";
import { demoDataNow, demoFlagsNow } from "@/lib/demoData";
import { sgDate, DAY_MS } from "@/lib/time";
import { aiConfigured, runStructured } from "@/lib/ai/client";
import { allowRequest, hashSubject, readCache, writeCache } from "@/lib/ai/guard";
import {
  BRIEFING_SYSTEM, BriefingSchema, CHECK_NAMES, INSIGHTS_SYSTEM, InsightsSchema, SECURITY_SYSTEM, SecurityHelpSchema,
  deviceFacts, fleetFacts, type Briefing, type Insights, type NotUsableBreakdown, type SecurityHelp,
} from "@/lib/ai/features";
import type { DevicesData } from "@/lib/devicesData";

// "peek" returns a saved answer without calling the AI (used when a page loads);
// "generate" reuses a recent answer or makes a new one; "refresh" always makes a new one.
export type AiMode = "peek" | "generate" | "refresh";
export type AiResponse<T> =
  | { status: "ok"; data: T; createdAt: string }
  | { status: "empty" }
  | { status: "off" }
  | { status: "error"; error: string };

const H = 3600000;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/** Cache lookup, rate limit, AI call and cache write shared by every feature. */
async function cachedRun<T>(opts: {
  mode: AiMode; key: string | null; kind: string; peekMaxAge: number; reuseMaxAge: number;
  limit: { subject: string; count: number; windowMs: number };
  run: () => ReturnType<typeof runStructured>;
}): Promise<AiResponse<T>> {
  if (!aiConfigured()) return { status: "off" };
  if (opts.key && opts.mode !== "refresh") {
    const hit = await readCache<T>(opts.key, opts.mode === "peek" ? opts.peekMaxAge : opts.reuseMaxAge);
    if (hit) return { status: "ok", data: hit.content, createdAt: hit.createdAt };
  }
  if (opts.mode === "peek") return { status: "empty" };
  if (!(await allowRequest(opts.kind, opts.limit.subject, opts.limit.count, opts.limit.windowMs))) {
    return { status: "error", error: "You've reached the limit for AI requests for now. Try again later." };
  }
  const result = await opts.run();
  if (!result.ok) return { status: "error", error: result.error };
  const createdAt = opts.key ? await writeCache(opts.key, opts.kind, result.data, result.model) : new Date().toISOString();
  return { status: "ok", data: result.data as T, createdAt };
}

// ---------------------------------------------------------------------------
// Device insights
// ---------------------------------------------------------------------------

/** Why awake minutes didn't count, from the last 7 days of agent readings (about one per minute). */
async function notUsableBreakdown(deviceId: string): Promise<NotUsableBreakdown | null> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const { data: settings } = await supabase.from("device_settings").select("cpu_threshold_pct").eq("device_id", deviceId).maybeSingle();
  const cpuMax = settings?.cpu_threshold_pct ?? 20;
  const count = async (filter: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const { count, error } = await filter(base());
    if (error) throw error;
    return count ?? 0;
  };
  function base() {
    return supabase.from("telemetry").select("id", { count: "exact", head: true }).eq("device_id", deviceId).gte("ts", since);
  }
  try {
    const [awake, usable, battery, cpu] = await Promise.all([
      count((q) => q),
      count((q) => q.eq("usable_idle", true)),
      count((q) => q.eq("usable_idle", false).eq("plugged_in", false)),
      count((q) => q.eq("usable_idle", false).eq("plugged_in", true).gte("cpu_pct", cpuMax)),
    ]);
    return { awake_minutes: awake, usable_minutes: usable, on_battery: battery, cpu_busy: cpu, recently_used: Math.max(0, awake - usable - battery - cpu) };
  } catch {
    return null;
  }
}

function insightsRun(data: DevicesData, breakdown: NotUsableBreakdown | null) {
  return () => runStructured({
    system: INSIGHTS_SYSTEM,
    input: `Device facts (JSON):\n${JSON.stringify(deviceFacts(data, breakdown))}`,
    schema: InsightsSchema,
  });
}

export async function deviceInsights(deviceId: string, mode: AiMode, demo = false): Promise<AiResponse<Insights>> {
  if (demo) {
    const all = demoDataNow();
    const devices = all.devices.filter((d) => d.id === deviceId);
    if (!devices.length) return { status: "error", error: "Device not found." };
    // Sample data changes once a day, so one answer per device per day serves every visitor.
    return cachedRun<Insights>({
      mode: mode === "refresh" ? "generate" : mode, key: `insights:demo:${deviceId}:${sgDate(all.now)}`, kind: "insights_demo",
      peekMaxAge: DAY_MS, reuseMaxAge: DAY_MS,
      limit: { subject: hashSubject(await clientIp()), count: 6, windowMs: DAY_MS },
      run: insightsRun({ ...all, devices }, null),
    });
  }
  const user = await requireUser();
  const profile = await getProfile();
  const data = await loadDevicesData(user.id, profile?.electricity_rate ?? null, deviceId); // only this user's device
  if (!data.devices.length) return { status: "error", error: "Device not found." };
  return cachedRun<Insights>({
    mode, key: `insights:${deviceId}`, kind: "insights",
    peekMaxAge: 7 * DAY_MS, reuseMaxAge: 6 * H,
    limit: { subject: user.id, count: 15, windowMs: DAY_MS },
    run: async () => insightsRun(data, await notUsableBreakdown(deviceId))(),
  });
}

// ---------------------------------------------------------------------------
// Security fix assistant
// ---------------------------------------------------------------------------

export async function securityHelp(flagId: string, mode: AiMode, question = "", demo = false): Promise<AiResponse<SecurityHelp>> {
  const asked = question.trim().slice(0, 300);
  let flag: { category: string; detail: string | null; device_id: string } | null = null;
  let os = "Unknown";
  let subject: string;

  if (demo) {
    if (asked) return { status: "error", error: "Sign in to ask your own question." };
    flag = demoFlagsNow().find((f) => String(f.id) === flagId) ?? null;
    os = demoDataNow().devices.find((d) => d.id === flag?.device_id)?.os ?? os;
    subject = hashSubject(await clientIp());
  } else {
    const user = await requireUser();
    subject = user.id;
    const supabase = await createClient(); // RLS: only flags on this user's devices
    const { data } = await supabase.from("security_flags").select("category, detail, device_id").eq("id", flagId).maybeSingle();
    flag = data;
    if (flag) {
      const { data: device } = await supabase.from("devices").select("os").eq("id", flag.device_id).maybeSingle();
      os = device?.os ?? os;
    }
  }
  if (!flag || !CHECK_NAMES[flag.category]) return { status: "error", error: "Security issue not found." };

  const facts = { operating_system: os, failed_check: CHECK_NAMES[flag.category], detail: flag.detail };
  return cachedRun<SecurityHelp>({
    // Without a question the answer depends only on the OS and the check, so it's shared by everyone.
    mode,
    key: asked ? null : `security:${flag.category}:${os.toLowerCase()}`, kind: "security",
    peekMaxAge: 30 * DAY_MS, reuseMaxAge: 30 * DAY_MS,
    limit: { subject, count: demo ? 5 : 10, windowMs: H },
    run: () => runStructured({
      system: SECURITY_SYSTEM,
      input: `Facts (JSON):\n${JSON.stringify(facts)}${asked ? `\n\n<question>\n${asked}\n</question>` : ""}`,
      schema: SecurityHelpSchema,
    }),
  });
}

// ---------------------------------------------------------------------------
// Operator fleet briefing
// ---------------------------------------------------------------------------

export async function fleetBriefing(mode: AiMode): Promise<AiResponse<Briefing>> {
  const admin = await requireAdmin();
  const fleet = await loadFleet();
  return cachedRun<Briefing>({
    mode, key: "briefing", kind: "briefing",
    peekMaxAge: 3 * DAY_MS, reuseMaxAge: H,
    limit: { subject: admin!.id, count: 20, windowMs: DAY_MS },
    // Device names and numbers only: owner emails are never sent to the AI.
    run: () => runStructured({ system: BRIEFING_SYSTEM, input: `Fleet facts (JSON):\n${JSON.stringify(fleetFacts(fleet))}`, schema: BriefingSchema }),
  });
}
