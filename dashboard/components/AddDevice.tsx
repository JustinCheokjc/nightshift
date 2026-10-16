"use client";

import { useState } from "react";
import { createAgentSetupKey } from "@/app/actions/agent";
import Icon from "@/components/Icon";

export type Download = { label: string; href: string; note: string };

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surf)] text-xs font-semibold tabular-nums">
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] font-medium">{title}</p>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}

export default function AddDevice({ downloads, compact = false }: { downloads: Download[]; compact?: boolean }) {
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function makeKey() {
    setBusy(true);
    setError(null);
    try {
      setKey(await createAgentSetupKey());
      setCopied(false);
    } catch {
      setError("Couldn't create a setup key. Refresh the page and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch {
      setError("Copy failed. Select the key and copy it by hand.");
    }
  }

  return (
    <div id="add-device" className="card scroll-mt-20">
      <div className="card-head">
        <div>
          <h2 className="card-title">Add a device</h2>
          <p className="card-sub">
            {compact
              ? "Install the agent on another computer."
              : "Install the Nightshift agent on any Windows, Mac or Linux computer. It measures when the computer is idle and reports here every minute."}
          </p>
        </div>
      </div>
      <ol className="relative before:absolute before:bottom-3 before:left-3 before:top-3 before:w-px before:bg-[var(--line)]">
        <Step n={1} title="Download the agent">
          <div className="flex flex-wrap gap-2">
            {downloads.map((d) => (
              <a key={d.href} href={d.href} download className="btn btn-sm" title={d.note}>
                <Icon name="download" size={14} /> {d.label}
              </a>
            ))}
          </div>
        </Step>
        <Step n={2} title="Create a setup key">
          <p className="mb-2 text-xs text-[var(--mut)]">Each key works once, for one hour.</p>
          {key ? (
            <div className="flex flex-col gap-2">
              <textarea
                id="agent-setup-key"
                readOnly
                value={key}
                rows={3}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full resize-none break-all rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 py-2 font-mono text-xs"
              />
              <div className="flex gap-2">
                <button type="button" onClick={copy} className="btn btn-sm btn-primary">
                  <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "Copied" : "Copy key"}
                </button>
                <button type="button" onClick={makeKey} disabled={busy} className="btn btn-sm">
                  New key
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={makeKey} disabled={busy} className="btn btn-primary">
              <Icon name="plus" size={14} /> {busy ? "Creating…" : "Create setup key"}
            </button>
          )}
        </Step>
        <Step n={3} title="Open the agent, accept the privacy notice and paste the key" />
      </ol>
      {error && <p className="mt-3 text-xs text-[var(--bad)]">{error}</p>}
    </div>
  );
}
