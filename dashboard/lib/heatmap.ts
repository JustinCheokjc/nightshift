import { sgDateDaysAgo, sgMidnight } from "@/lib/time";
import type { SessionRow } from "@/lib/devicesData";

export type HeatDay = { date: string; label: string; hours: { idle: number; use: number }[] };

/** Share of each hour (Singapore time) spent usable-idle or in use, for the last `days` days. */
export function buildHeatmap(sessions: SessionRow[], now: number, days = 7): HeatDay[] {
  const spans = sessions.map((s) => ({
    a: Date.parse(s.start_ts),
    b: s.end_ts ? Date.parse(s.end_ts) : now,
    type: s.type,
  }));
  const out: HeatDay[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = sgDateDaysAgo(now, d);
    const start = sgMidnight(date);
    const hours = Array.from({ length: 24 }, (_, h) => {
      const h0 = start + h * 3600000, h1 = h0 + 3600000;
      let idle = 0, use = 0;
      for (const s of spans) {
        const overlap = Math.min(s.b, h1, now) - Math.max(s.a, h0);
        if (overlap <= 0) continue;
        if (s.type === "usable_idle") idle += overlap;
        else if (s.type === "in_use") use += overlap;
      }
      return { idle: idle / 3600000, use: use / 3600000 };
    });
    const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", timeZone: "UTC" });
    out.push({ date, label, hours });
  }
  return out;
}
