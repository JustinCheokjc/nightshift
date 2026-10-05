"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

export type CommandItem = {
  label: string;
  href?: string;
  onSelect?: () => void | Promise<void>;
};

export default function CommandPalette({ items }: { items: CommandItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function select(item: CommandItem) {
    setOpen(false);
    if (item.onSelect) item.onSelect();
    else if (item.href) router.push(item.href);
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) select(filtered[active]);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--mut)]"
        aria-label="Open command palette"
      >
        <span>Jump to</span>
        <kbd className="rounded border border-[var(--line)] px-1 font-sans text-[10px]">
          {typeof navigator !== "undefined" && navigator.platform.includes("Mac")
            ? "⌘K"
            : "Ctrl K"}
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--surf)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Jump to..."
              className="w-full border-b border-[var(--line)] bg-transparent px-4 py-3 text-sm outline-none"
            />
            <ul className="max-h-72 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-[var(--mut)]">No matches</li>
              )}
              {filtered.map((item, i) => (
                <li key={item.label}>
                  <button
                    onClick={() => select(item)}
                    onMouseEnter={() => setActive(i)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                      i === active ? "bg-[var(--idle)] text-white" : ""
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-[var(--line)] px-3 py-2 text-xs text-[var(--mut)]">
              ↑↓ to navigate · Enter to select · Esc to close
            </div>
          </div>
        </div>
      )}
    </>
  );
}
