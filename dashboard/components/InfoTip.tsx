"use client";

import { useId, useState } from "react";

/** Small ⓘ button that explains a number. Opens on hover, focus or tap. */
export default function InfoTip({ text, label = "How is this calculated?" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-describedby={open ? id : undefined}
        onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--line)] text-[10px] font-semibold leading-none text-[var(--mut)] transition-colors hover:border-[var(--mut)] hover:text-[var(--ink)]">
        i
      </button>
      {open && (
        <span id={id} role="tooltip"
          className="absolute left-1/2 top-full z-40 mt-2 w-64 -translate-x-1/2 rounded-lg border border-[var(--line)] bg-[var(--surf)] px-3 py-2 text-xs font-normal leading-relaxed text-[var(--ink)] shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}
