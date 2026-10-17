"use client";

import { useState } from "react";
import { securityHelp } from "@/app/actions/ai";
import Icon from "@/components/Icon";
import { AiError, AiLabel, Thinking, useAi } from "@/components/ai/useAi";

/** Under a failed security check: AI steps for this exact OS, plus an optional follow-up question. */
export default function SecurityHelp({ flagId, demo = false }: { flagId: string; demo?: boolean }) {
  const [question, setQuestion] = useState("");
  const [open, setOpen] = useState(false);
  const { data, error, off, pending, run } = useAi((mode) => securityHelp(flagId, mode, mode === "peek" ? "" : question, demo), { autoPeek: false });
  if (off) return null;
  const help = data?.value;

  if (!open) {
    return (
      <button type="button" className="btn btn-sm mt-4" onClick={() => { setOpen(true); run("generate"); }}>
        <Icon name="spark" size={14} /> Get tailored help for this computer
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--idle)_30%,var(--line))] p-4">
      {pending && !help && <Thinking text="Writing steps for this computer…" />}
      {help && (
        <div className={pending ? "opacity-60 transition-opacity" : ""}>
          {help.on_topic && <p className="text-[13px]">{help.why_it_matters}</p>}
          {help.on_topic && help.steps.length > 0 && (
            <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-[13px]">
              {help.steps.slice(0, 8).map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
          <p className="mt-3 text-[13px] text-[var(--mut)]">{help.if_stuck}</p>
          {help.caution && help.on_topic && (
            <p className="mt-3 flex gap-2 rounded-lg bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] px-3 py-2 text-xs">
              <Icon name="alert" size={14} className="mt-px shrink-0 text-[var(--amber)]" /> {help.caution}
            </p>
          )}
        </div>
      )}
      {error && <AiError text={error} />}

      {demo ? (
        <p className="mt-3 text-xs text-[var(--mut)]">Sign in to ask your own follow-up question.</p>
      ) : (
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (question.trim()) run("generate"); }}>
          <label htmlFor={`q-${flagId}`} className="sr-only">Ask a follow-up question</label>
          <input id={`q-${flagId}`} className="input flex-1" maxLength={300} value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder="Stuck? Describe what you see, e.g. “I can't find BitLocker”" />
          <button type="submit" className="btn btn-sm" disabled={pending || !question.trim()}>Ask</button>
        </form>
      )}
      <div className="mt-3"><AiLabel createdAt={data?.createdAt} /></div>
    </div>
  );
}
