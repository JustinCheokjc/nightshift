// Sample data for the public demo at /demo. Deterministic for a given day, and
// shaped like real agent data: in use by day, idle and plugged in overnight.
import { DAY_MS, sgDate, sgMidnight } from "@/lib/time";
import { DEFAULT_ELECTRICITY_RATE } from "@/lib/estimates";
import type { DevicesData, DeviceRow, SessionRow, SummaryRow } from "@/lib/devicesData";

const H = 3600000;

export const DEMO_DEVICES: DeviceRow[] = [
  { id: "demo-laptop", name: "Justin's laptop", os: "Windows 11", cores: 8, ram_gb: 16, cpu_model: "Intel Core i7-1360P",
    agent_version: "0.3.0", status: "idle", enrolled_at: "" },
  { id: "demo-mac", name: "Studio MacBook", os: "macOS 15", cores: 10, ram_gb: 16, cpu_model: "Apple M3",
    agent_version: "0.3.0", status: "in_use", enrolled_at: "" },
  { id: "demo-desktop", name: "Lab desktop", os: "Ubuntu 24.04", cores: 16, ram_gb: 32, cpu_model: "AMD Ryzen 9 7950X",
    agent_version: "0.3.0", status: "idle", enrolled_at: "" },
];
// [start hour, end hour) of usable idle each Singapore day; the rest of waking time is in use.
const IDLE_HOURS: Record<string, [number, number][]> = {
  "demo-laptop": [[0, 7.5], [12.5, 13.5], [23, 24]],
  "demo-mac": [[1, 8], [19, 20]],
  "demo-desktop": [[0, 8.5], [18, 24]],
};
const AWAKE: Record<string, [number, number]> = { "demo-laptop": [0, 24], "demo-mac": [0, 23], "demo-desktop": [0, 24] };

function jitter(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x); // 0..1, deterministic
}

export function demoDevicesData(now: number): DevicesData {
  const sessions: SessionRow[] = [];
  const summaries: SummaryRow[] = [];
  const days = 14;
  for (let d = days - 1; d >= 0; d--) {
    const date = sgDate(now - d * DAY_MS);
    const mid = sgMidnight(date);
    DEMO_DEVICES.forEach((dev, k) => {
      let idle = 0, up = 0;
      const [wake, sleep] = AWAKE[dev.id];
      let cursor = mid + wake * H;
      // Some nights the laptop goes to sleep or off the charger: no idle that night.
      const unplugged = dev.id === "demo-laptop" && jitter(d * 13 + 5) < 0.18;
      if (unplugged) { // asleep until morning instead
        sessions.push(span(dev.id, cursor, mid + 7 * H, "asleep", now));
        cursor = mid + 7 * H;
      }
      IDLE_HOURS[dev.id].forEach(([a0, b0], j) => {
        if (unplugged && a0 === 0) return;
        const r = jitter(d * 7 + k * 3 + j);
        const shift = (r - 0.5) * 3; // up to ±1.5 h of variation per block per day
        const len = Math.max(0.5, b0 - a0 + (b0 === 24 ? 0 : shift));
        const startH = a0 === 0 ? 0 : Math.max(wake, a0 + shift / 2);
        const a = mid + startH * H, b = mid + Math.min(sleep, startH + len) * H;
        if (b <= a || a < cursor) return;
        if (cursor < a) sessions.push(span(dev.id, cursor, a, "in_use", now));
        sessions.push(span(dev.id, a, b, "usable_idle", now));
        idle += Math.max(0, Math.min(b, now) - a) / H;
        cursor = b;
      });
      const end = mid + sleep * H;
      if (cursor < end) sessions.push(span(dev.id, cursor, end, "in_use", now));
      if (sleep < 24) sessions.push(span(dev.id, end, mid + 24 * H, "asleep", now));
      up = Math.max(0, Math.min(mid + sleep * H, now) - (mid + wake * H)) / H;
      if (up > 0) {
        summaries.push({ device_id: dev.id, date, usable_idle_hours: round(idle), core_hours: round(idle * (dev.cores ?? 4)), uptime_hours: round(up) });
      }
    });
  }
  return {
    now,
    devices: DEMO_DEVICES.map((dev, k) => {
      const current = sessions.find((x) => x.device_id === dev.id && Date.parse(x.start_ts) <= now && x.end_ts === null);
      const status = current?.type === "usable_idle" ? "idle" : current?.type ?? "asleep";
      return { ...dev, status, enrolled_at: new Date(now - (days - k) * DAY_MS).toISOString() };
    }),
    settings: DEMO_DEVICES.map((d) => ({ device_id: d.id, idle_threshold_sec: 300, idle_threshold_min: 5 })),
    summaries,
    sessions: sessions.filter((s) => Date.parse(s.start_ts) < now && (s.end_ts === null || Date.parse(s.end_ts) > now - 7 * DAY_MS)),
    electricityRate: DEFAULT_ELECTRICITY_RATE,
    downloads: [],
  };
}

function span(device_id: string, a: number, b: number, type: SessionRow["type"], now: number): SessionRow {
  return { device_id, start_ts: new Date(a).toISOString(), end_ts: b >= now ? null : new Date(b).toISOString(), type };
}
const round = (v: number) => Math.round(v * 100) / 100;

export const DEMO_FLAGS = [
  { id: "demo-flag", device_id: "demo-laptop", category: "firewall", severity: "medium", status: "open",
    detail: "Windows Firewall is turned off", first_seen: "" },
];

/** Demo data as of this request. */
export function demoDataNow(): DevicesData {
  return demoDevicesData(Date.now());
}

export function demoActivity() {
  const now = Date.now();
  return [
    { id: "d1", label: "Security check failed: firewall", detail: "Justin's laptop: Windows Firewall is turned off. See the Security tab to fix it.", ts: new Date(now - 3 * 3600000).toISOString(), tone: "bad" as const },
    { id: "d2", label: "Wallet: pilot payment", detail: "S$20.00, pending", ts: new Date(now - 26 * 3600000).toISOString(), tone: "info" as const },
    { id: "d3", label: "Device added: Lab desktop", detail: "Setup key used. The agent is linked to your account.", ts: new Date(now - 6 * 86400000).toISOString(), tone: "info" as const },
  ];
}

export function demoFlagsNow() {
  return DEMO_FLAGS.map((f) => ({ ...f, first_seen: new Date(Date.now() - 3 * 3600000).toISOString() }));
}
