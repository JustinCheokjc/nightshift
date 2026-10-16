"use client";

import { useSyncExternalStore } from "react";
import Icon from "@/components/Icon";

const KEY = "nightshift-onboarding-dismissed";
const EVENT = "nightshift-onboarding";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}
function read() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** Getting-started checklist. Steps tick off from real data; hidden once done or dismissed. */
export default function Onboarding({ steps }: { steps: { added: boolean; reporting: boolean; fullDay: boolean } }) {
  // Server and first client render assume "dismissed" so a dismissed checklist never flashes.
  const dismissed = useSyncExternalStore(subscribe, read, () => true);
  const items = [
    { done: steps.added, title: "Add your first device", body: "Download the agent below, create a setup key and paste it into the agent.", href: "#add-device", cta: "Add a device" },
    { done: steps.reporting, title: "Receive the first reading", body: "The agent reports every minute. Leave it running and the status turns live." },
    { done: steps.fullDay, title: "Record a full day", body: "After one full day (Singapore time) you'll see daily idle hours and estimates." },
  ];
  const doneCount = items.filter((i) => i.done).length;
  if (dismissed || doneCount === items.length) return null;

  function dismiss() {
    try { localStorage.setItem(KEY, "1"); } catch {}
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <section className="card" aria-label="Getting started">
      <div className="card-head">
        <div>
          <h2 className="card-title">Get started</h2>
          <p className="card-sub">{doneCount} of {items.length} done. Each step ticks off by itself.</p>
        </div>
        <button type="button" onClick={dismiss} className="btn btn-sm border-transparent text-[var(--mut)]">Dismiss</button>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[var(--sleep)]">
        <div className="h-full rounded-full bg-[var(--idle)] transition-[width] duration-500" style={{ width: `${(doneCount / items.length) * 100}%` }} />
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {items.map((it, i) => {
          const current = !it.done && items.slice(0, i).every((x) => x.done);
          return (
            <li key={it.title} className={`flex gap-3 rounded-lg border p-3.5 ${current ? "border-[color-mix(in_srgb,var(--idle)_50%,var(--line))] bg-[color-mix(in_srgb,var(--idle)_6%,transparent)]" : "border-[var(--line)]"}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${it.done ? "bg-[var(--idle)] text-[var(--on)]" : "border border-[var(--line)] text-[var(--mut)]"}`}>
                {it.done ? <Icon name="check" size={13} /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className={`text-[13px] font-medium ${it.done ? "text-[var(--mut)] line-through" : ""}`}>{it.title}</p>
                <p className="mt-0.5 text-xs text-[var(--mut)]">{it.body}</p>
                {current && it.href && <a href={it.href} className="btn btn-sm btn-primary mt-2.5">{it.cta}</a>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
