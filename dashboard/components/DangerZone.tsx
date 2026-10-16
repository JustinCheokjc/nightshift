"use client";

import { useState } from "react";
import { deleteMyData } from "@/app/actions/controls";
import Icon from "@/components/Icon";

/** Delete-everything control that asks the person to type DELETE first. */
export default function DangerZone() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  return (
    <div className="card border-[color-mix(in_srgb,var(--bad)_35%,var(--line))]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="card-title flex items-center gap-2 text-[var(--bad)]">
            <Icon name="alert" size={15} /> Delete my data
          </h2>
          <p className="card-sub">
            Permanently removes your devices, their history, security checks and wallet entries. This can&apos;t be undone.
            Your agents stop being able to report until you add them again.
          </p>
        </div>
        {!open && (
          <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>
            Delete my data
          </button>
        )}
      </div>
      {open && (
        <form action={deleteMyData} className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-4">
          <div className="w-full max-w-xs">
            <label htmlFor="confirm-delete" className="label">
              Type <b className="font-mono text-[var(--ink)]">DELETE</b> to confirm
            </label>
            <input id="confirm-delete" className="input font-mono" autoComplete="off" value={text}
              onChange={(e) => setText(e.target.value)} autoFocus />
          </div>
          <button type="submit" className="btn btn-danger-solid" disabled={text !== "DELETE"}>
            Delete permanently
          </button>
          <button type="button" className="btn" onClick={() => { setOpen(false); setText(""); }}>
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
