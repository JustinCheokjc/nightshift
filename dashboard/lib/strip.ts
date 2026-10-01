export type SessionRow = {
  start_ts: string;
  end_ts: string | null;
  type: "usable_idle" | "in_use" | "asleep" | "offline";
};

// 48 half-hour cells covering the last 24 hours, classed for the .strip
// component ported from idle-compute-mockups.html ("u" = in use, "d" = idle).
export function buildDayStrip(sessions: SessionRow[]): string[] {
  const now = Date.now();
  const windowStart = now - 24 * 60 * 60 * 1000;
  const cellMs = (24 * 60 * 60 * 1000) / 48;

  return Array.from({ length: 48 }, (_, i) => {
    const mid = windowStart + i * cellMs + cellMs / 2;
    const hit = sessions.find((s) => {
      const start = new Date(s.start_ts).getTime();
      const end = s.end_ts ? new Date(s.end_ts).getTime() : now;
      return mid >= start && mid < end;
    });
    if (!hit) return "";
    if (hit.type === "usable_idle") return "d";
    if (hit.type === "in_use") return "u";
    return "";
  });
}

export function sumBy<T>(rows: T[], pick: (row: T) => number): number {
  return Math.round(rows.reduce((acc, r) => acc + pick(r), 0) * 10) / 10;
}
