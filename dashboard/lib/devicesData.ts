import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { sgDate, sgDateDaysAgo, DAY_MS } from "@/lib/time";
import { DEFAULT_ELECTRICITY_RATE } from "@/lib/estimates";

import type { Download } from "@/components/AddDevice";
export type { Download };
export type DeviceRow = {
  id: string; name: string; os: string; cores: number | null; ram_gb: number | null;
  cpu_model: string | null; gpu_model?: string | null; agent_version?: string | null;
  status: string; enrolled_at: string;
};
export type SettingsRow = { device_id: string; idle_threshold_sec?: number | null; idle_threshold_min?: number | null };
export type SummaryRow = { device_id: string; date: string; usable_idle_hours: number; core_hours: number; uptime_hours: number };
export type SessionRow = { device_id: string; start_ts: string; end_ts: string | null; type: "usable_idle" | "in_use" | "asleep" | "offline" };

export type DevicesData = {
  now: number;
  devices: DeviceRow[];
  settings: SettingsRow[];
  summaries: SummaryRow[]; // every day on record, oldest first
  sessions: SessionRow[]; // sessions overlapping the last 7 days
  electricityRate: number;
  downloads: Download[];
};

// Agent builds live in public/downloads (built by .github/workflows/build-agent.yml).
const AGENT_DOWNLOADS: Download[] = [
  { label: "Windows", href: "/downloads/nightshift-agent-windows.exe", note: "Windows 10 or 11" },
  { label: "Mac", href: "/downloads/nightshift-agent-macos.zip", note: "Apple silicon Macs. Intel Macs: use the Python script" },
  { label: "Linux", href: "/downloads/nightshift-agent-linux", note: "x86-64 desktop Linux" },
  { label: "Python script (any OS)", href: "/downloads/nightshift_agent.py", note: "Needs Python 3.9+" },
];
export function availableDownloads() {
  return AGENT_DOWNLOADS.filter((d) => existsSync(path.join(process.cwd(), "public", d.href)));
}

/** Everything the Devices and device detail pages show, for one user. */
export async function loadDevicesData(userId: string, electricityRate: number | null, onlyDevice?: string): Promise<DevicesData> {
  const supabase = await createClient();
  const now = Date.now();
  let q = supabase.from("devices").select("*").eq("user_id", userId).order("enrolled_at");
  if (onlyDevice) q = q.eq("id", onlyDevice);
  const { data: devices } = await q;
  const ids = (devices ?? []).map((d) => d.id);
  const weekAgoIso = new Date(now - 7 * DAY_MS).toISOString();

  const [{ data: settings }, { data: summaries }, { data: sessions }] = ids.length
    ? await Promise.all([
        supabase.from("device_settings").select("*").in("device_id", ids),
        supabase.from("daily_summary").select("device_id, date, usable_idle_hours, core_hours, uptime_hours").in("device_id", ids).order("date"),
        // end_ts (not start_ts) so sessions that started earlier but are still ongoing are included.
        supabase.from("sessions").select("device_id, start_ts, end_ts, type").in("device_id", ids).or(`end_ts.gte.${weekAgoIso},end_ts.is.null`),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return {
    now,
    devices: (devices ?? []) as DeviceRow[],
    settings: (settings ?? []) as SettingsRow[],
    summaries: ((summaries ?? []) as SummaryRow[]).map((s) => ({
      ...s, usable_idle_hours: Number(s.usable_idle_hours), core_hours: Number(s.core_hours), uptime_hours: Number(s.uptime_hours),
    })),
    sessions: (sessions ?? []) as SessionRow[],
    electricityRate: electricityRate ?? DEFAULT_ELECTRICITY_RATE,
    downloads: availableDownloads(),
  };
}

export const today = (now: number) => sgDate(now);
export const weekStart = (now: number) => sgDateDaysAgo(now, 6); // 7 days including today
