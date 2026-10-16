"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Icon from "@/components/Icon";

export type ActivityEvent = {
  id: string;
  label: string;
  detail: string;
  ts: string;
  tone?: "bad" | "warn" | "info";
};

const STORAGE_KEY = "nightshift-activity-last-seen";
const SEEN_EVENT = "nightshift-activity-seen";

function subscribe(cb: () => void) {
  window.addEventListener(SEEN_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(SEEN_EVENT, cb); window.removeEventListener("storage", cb); };
}
function readSeen() {
  try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
}

const DOT = { bad: "bg-[var(--bad)]", warn: "bg-[var(--amber)]", info: "bg-[var(--idle)]" } as const;

function ago(ts: string) {
  const min = Math.round((Date.now() - Date.parse(ts)) / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ts).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}

export default function ActivityBell({ events }: { events: ActivityEvent[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Server render has no storage: treat everything as seen so the dot never flashes.
  const lastSeen = useSyncExternalStore(subscribe, readSeen, () => null);
  const newest = events[0]?.ts;
  const unseenCount = lastSeen === null ? 0 : events.filter((e) => !lastSeen || Date.parse(e.ts) > Date.parse(lastSeen)).length;
  const urgent = events.some((e) => e.tone === "bad" || e.tone === "warn");

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function toggle() {
    setOpen((o) => !o);
    if (!open && newest) {
      try { localStorage.setItem(STORAGE_KEY, newest); } catch {}
      window.dispatchEvent(new Event(SEEN_EVENT));
    }
  }

  return (
    <div className="relative" ref={box}>
      <button onClick={toggle} aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] hover:bg-[var(--surf)]"
        aria-label={unseenCount ? `Notifications, ${unseenCount} new` : "Notifications"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unseenCount > 0 && (
          <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${urgent ? "bg-[var(--bad)]" : "bg-[var(--idle)]"}`}>
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surf)] shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            <span className="text-xs text-[var(--mut)]">{events.length ? `${events.length} recent` : ""}</span>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {!events.length && (
              <li className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-[var(--mut)]">
                <Icon name="check" size={18} className="text-[var(--idle)]" />
                You&apos;re all caught up.
              </li>
            )}
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 border-b border-[var(--line)] px-4 py-3 last:border-0">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[e.tone ?? "info"]}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{e.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--mut)]">{e.detail}</p>
                  <p className="mt-1 text-[11px] text-[var(--mut)]">{ago(e.ts)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
