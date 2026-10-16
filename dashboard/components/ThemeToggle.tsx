"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "nightshift-theme";
const EVENT = "nightshift-theme";

// The theme lives on <html data-theme> (set before paint by app/layout.tsx), so read it from there.
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
const read = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

function applyTheme(next: "dark" | "light") {
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as const);

  function toggle() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] hover:bg-[var(--surf)]"
    >
      {theme === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z" /></svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
      )}
    </button>
  );
}

/** Dark / Light segmented control for the Settings page. */
export function ThemePicker() {
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as const);
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--bg)] p-0.5">
      {(["dark", "light"] as const).map((t) => (
        <button key={t} type="button" role="radio" aria-checked={theme === t} onClick={() => applyTheme(t)}
          className={`h-7 rounded-md px-3 text-xs font-medium capitalize transition-colors ${theme === t ? "bg-[var(--surf)] text-[var(--ink)] shadow-sm" : "text-[var(--mut)] hover:text-[var(--ink)]"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}
