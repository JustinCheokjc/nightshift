"use client";

import { useEffect, useState, useTransition } from "react";
import type { AiMode, AiResponse } from "@/app/actions/ai";
import { agoText } from "@/lib/time";
import Icon from "@/components/Icon";
import InfoTip from "@/components/InfoTip";

/** Loads any saved AI answer on mount (no AI call), then generates on request. Keeps the last good answer if a new request fails. */
export function useAi<T>(call: (mode: AiMode) => Promise<AiResponse<T>>, { autoPeek = true } = {}) {
  const [data, setData] = useState<{ value: T; createdAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [off, setOff] = useState(false);
  const [pending, start] = useTransition();

  const apply = (r: AiResponse<T>) => {
    if (r.status === "ok") { setData({ value: r.data, createdAt: r.createdAt }); setError(null); }
    else if (r.status === "off") setOff(true);
    else if (r.status === "error") setError(r.error);
  };
  useEffect(() => {
    if (!autoPeek) return;
    let live = true;
    call("peek").then((r) => { if (live) apply(r); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per mount
  }, []);

  const run = (mode: AiMode) => start(async () => {
    try { apply(await call(mode)); } catch { setError("Something went wrong. Try again."); }
  });
  return { data, error, off, pending, run };
}

const ABOUT_AI = "Written by Claude, an AI model from Anthropic, using only summary facts such as hours, settings and your operating system. It never sees your files, keystrokes or anything the agent doesn't collect. AI can be wrong: check anything important.";

/** Label shown on every AI-written block. */
export function AiLabel({ createdAt }: { createdAt?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--mut)]">
      <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--idle)_35%,var(--line))] bg-[color-mix(in_srgb,var(--idle)_10%,transparent)] px-2 py-0.5 font-medium text-[var(--idle)]">
        <Icon name="spark" size={12} /> AI
      </span>
      {createdAt ? `Generated ${agoText(createdAt)}` : "AI-generated"}
      <InfoTip text={ABOUT_AI} label="About this AI answer" />
    </span>
  );
}

export function AiError({ text }: { text: string }) {
  return <p role="alert" className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] px-3 py-2 text-xs text-[var(--bad)]">{text}</p>;
}

export function Thinking({ text = "Thinking…" }: { text?: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-[var(--mut)]" aria-live="polite">
      <Icon name="spark" size={14} className="animate-pulse text-[var(--idle)]" /> {text}
    </p>
  );
}
