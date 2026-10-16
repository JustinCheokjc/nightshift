import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DAY_MS, sgDateDaysAgo, sgHour } from "@/lib/time";

export type FleetDevice = {
  id: string; name: string; os: string; cores: number | null; status: string; enrolled_at: string; user_id: string;
  owner: string; idle7d: number; core7d: number; lastSeen: number | null; openFlags: number;
};
export type HourStat = { hour: number; usable: number; inUse: number; coreHours: number };

/** Fleet-wide numbers for the operator console, computed from what the agents actually reported. */
export async function loadFleet() {
  const supabase = await createClient(); // admins can read every row (RLS is_admin())
  const now = Date.now();
  const weekStart = sgDateDaysAgo(now, 6);
  const since = new Date(now - 7 * DAY_MS).toISOString();

  const [{ data: devices }, { data: profiles }, { data: summaries }, { data: sessions }, { data: flags }] = await Promise.all([
    supabase.from("devices").select("id, name, os, cores, status, enrolled_at, user_id").order("enrolled_at"),
    supabase.from("profiles").select("id, email"),
    supabase.from("daily_summary").select("device_id, date, usable_idle_hours, core_hours").gte("date", weekStart),
    supabase.from("sessions").select("device_id, start_ts, end_ts, type").or(`end_ts.gte.${since},end_ts.is.null`),
    supabase.from("security_flags").select("device_id").eq("status", "open"),
  ]);

  const email = new Map((profiles ?? []).map((p) => [p.id, p.email as string]));
  const cores = new Map((devices ?? []).map((d) => [d.id, d.cores ?? 1]));
  const idle = new Map<string, number>(), core = new Map<string, number>(), seen = new Map<string, number>(), flagCount = new Map<string, number>();
  for (const s of summaries ?? []) {
    idle.set(s.device_id, (idle.get(s.device_id) ?? 0) + Number(s.usable_idle_hours));
    core.set(s.device_id, (core.get(s.device_id) ?? 0) + Number(s.core_hours));
  }
  for (const s of sessions ?? []) {
    if (s.type === "asleep") continue;
    const t = s.end_ts ? Date.parse(s.end_ts) : now;
    if (t > (seen.get(s.device_id) ?? 0)) seen.set(s.device_id, t);
  }
  for (const f of flags ?? []) flagCount.set(f.device_id, (flagCount.get(f.device_id) ?? 0) + 1);

  // Average devices usable-idle / in use in each hour of the day (Singapore time), over the last 7 days.
  const usableMs = new Array(24).fill(0), useMs = new Array(24).fill(0), coreMs = new Array(24).fill(0);
  const windowStart = now - 7 * DAY_MS;
  for (const s of sessions ?? []) {
    if (s.type !== "usable_idle" && s.type !== "in_use") continue;
    let a = Math.max(Date.parse(s.start_ts), windowStart);
    const b = Math.min(s.end_ts ? Date.parse(s.end_ts) : now, now);
    while (a < b) {
      const hourEnd = Math.min(b, Math.floor(a / 3600000) * 3600000 + 3600000);
      const h = sgHour(a), ms = hourEnd - a;
      if (s.type === "usable_idle") { usableMs[h] += ms; coreMs[h] += ms * (cores.get(s.device_id) ?? 1); }
      else useMs[h] += ms;
      a = hourEnd;
    }
  }
  const perHour = 7 * 3600000; // each hour of the day occurs 7 times in the window
  const hours: HourStat[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h, usable: usableMs[h] / perHour, inUse: useMs[h] / perHour, coreHours: coreMs[h] / perHour,
  }));

  const list: FleetDevice[] = (devices ?? []).map((d) => ({
    ...d, owner: email.get(d.user_id) ?? "Unknown", idle7d: idle.get(d.id) ?? 0, core7d: core.get(d.id) ?? 0,
    lastSeen: seen.get(d.id) ?? null, openFlags: flagCount.get(d.id) ?? 0,
  }));
  return { now, devices: list, hours, contributors: new Set(list.map((d) => d.user_id)).size };
}
