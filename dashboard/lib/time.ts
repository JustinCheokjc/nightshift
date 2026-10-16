// Nightshift's pilot runs in Singapore, so days are Singapore days (UTC+8, no
// daylight saving). daily_summary rows written before 2026-10-16 used UTC days.
export const TZ = "Asia/Singapore";
const OFFSET_MS = 8 * 3600 * 1000;
export const DAY_MS = 86400000;

/** Singapore calendar date (YYYY-MM-DD) for a timestamp. */
export function sgDate(ms: number): string {
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 10);
}

/** Hours elapsed since Singapore midnight. */
export function sgHoursToday(ms: number): number {
  return ((ms + OFFSET_MS) % DAY_MS) / 3600000;
}

/** Singapore date `days` days before the date of `ms`. */
export function sgDateDaysAgo(ms: number, days: number): string {
  return sgDate(ms - days * DAY_MS);
}

/** Midnight (as a UTC timestamp) that starts the given Singapore date. */
export function sgMidnight(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) - OFFSET_MS;
}

/** Hour of day (0-23) in Singapore for a timestamp. */
export function sgHour(ms: number): number {
  return Math.floor(((ms + OFFSET_MS) % DAY_MS) / 3600000);
}

/** Singapore date 30 days ago (for "last 30 days" queries). */
export function since30Days(): string {
  return sgDateDaysAgo(Date.now(), 30);
}

/** "just now", "5 min ago", "3 h ago", "2 d ago" for a past ISO timestamp. */
export function agoText(iso: string): string {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 2) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
