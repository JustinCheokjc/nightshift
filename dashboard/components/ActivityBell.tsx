"use client";

import { useEffect, useState } from "react";

export type ActivityEvent = {
  id: string;
  label: string;
  detail: string;
  ts: string;
};

const STORAGE_KEY = "nightshift-activity-last-seen";

export default function ActivityBell({ events }: { events: ActivityEvent[] }) {
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    const newest = events[0]?.ts;
    if (newest && (!lastSeen || new Date(newest) > new Date(lastSeen))) {
      setUnseen(true);
    }
  }, [events]);

  function toggle() {
    setOpen((o) => !o);
    if (!open && events[0]) {
      localStorage.setItem(STORAGE_KEY, events[0].ts);
      setUnseen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative rounded-lg border border-[var(--line)] p-1.5"
        aria-label="Activity"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unseen && (
          <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[var(--bad)]" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-[var(--line)] bg-[var(--surf)] shadow-xl">
          <div className="border-b border-[var(--line)] px-4 py-2 text-sm font-bold">
            Activity
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {!events.length && (
              <li className="px-4 py-3 text-sm text-[var(--mut)]">Nothing yet.</li>
            )}
            {events.map((e) => (
              <li
                key={e.id}
                className="border-b border-[var(--line)] px-4 py-2.5 last:border-0"
              >
                <p className="text-sm">{e.label}</p>
                <p className="text-xs text-[var(--mut)]">{e.detail}</p>
                <p className="mt-0.5 text-[11px] text-[var(--mut)]">
                  {new Date(e.ts).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
