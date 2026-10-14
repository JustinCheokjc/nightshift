"use client";

import { useState } from "react";
import { createAgentSetupKey } from "@/app/actions/agent";

export type Download = { label: string; href: string; note: string };

const BTN = "transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]";

export default function AddDevice({ downloads }: { downloads: Download[] }) {
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
    <div className="card">
      <h3 className="mb-1 text-sm font-bold">Add a device</h3>
      <p className="mb-3 text-sm text-[var(--mut)]">
        Install the Nightshift agent on any Windows, Mac or Linux computer. It
        measures when the computer is idle and reports here every minute.
      </p>
      <ol className="mb-3 flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>
          Download the agent:
          <span className="mt-1 flex flex-wrap gap-2">
            {downloads.map((d) => (
              <a
                key={d.href}
                href={d.href}
                download
                className={`rounded-lg border border-[var(--line)] px-3 py-1 text-xs ${BTN}`}
                title={d.note}
              >
                {d.label}
              </a>
            ))}
          </span>
        </li>
        <li>Create a setup key below. It works for one hour.</li>
        <li>Open the agent, accept the privacy notice and paste the key.</li>
      </ol>
      {key ? (
        <div className="flex flex-col gap-2">
          <textarea
            id="agent-setup-key"
            readOnly
            value={key}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full break-all rounded-lg border border-[var(--line)] bg-[var(--surf)] px-2 py-1 font-mono text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className={`rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--bg)] ${BTN}`}
            >
              {copied ? "Copied" : "Copy key"}
            </button>
            <button
              type="button"
              onClick={makeKey}
              disabled={busy}
              className={`rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs ${BTN}`}
            >
              New key
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={makeKey}
          disabled={busy}
          className={`rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--bg)] ${BTN}`}
        >
          {busy ? "Creating…" : "Create setup key"}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-[var(--bad)]">{error}</p>}
    </div>
  );
}
