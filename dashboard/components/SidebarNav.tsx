"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Icon, { type IconName } from "@/components/Icon";

export type NavItem = { href: string; label: string; icon: IconName };
export type NavGroup = { label?: string; items: NavItem[] };

function isActive(pathname: string, href: string, all: string[]) {
  if (pathname === href) return true;
  // Prefix match, unless a longer nav entry matches better (/admin vs /admin/team).
  return pathname.startsWith(href + "/") && !all.some((h) => h !== href && h.startsWith(href) && pathname.startsWith(h));
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  return (
    <nav className="flex flex-col gap-5" aria-label="Main">
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {g.label && <p className="eyebrow mb-1.5 px-2.5">{g.label}</p>}
          {g.items.map((item) => {
            const active = isActive(pathname, item.href, all);
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
                  active ? "bg-[var(--bg)] text-[var(--ink)]" : "text-[var(--mut)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                }`}>
                <Icon name={item.icon} className={active ? "text-[var(--idle)]" : ""} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function PageTitle({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const items = groups.flatMap((g) => g.items);
  const all = items.map((i) => i.href);
  const current = items.find((i) => isActive(pathname, i.href, all));
  return <span className="truncate text-sm font-medium">{current?.label ?? "Dashboard"}</span>;
}

/** Desktop: fixed sidebar. Mobile: a menu button that opens the same list in a drawer. */
export default function SidebarNav({ groups, header, footer }: {
  groups: NavGroup[]; header: React.ReactNode; footer: React.ReactNode;
}) {
  // Links close the drawer themselves via onNavigate.
  const [open, setOpen] = useState(false);

  const body = (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-5 pt-4">{header}</div>
      <div className="flex-1 overflow-y-auto px-3">
        <NavList groups={groups} onNavigate={() => setOpen(false)} />
      </div>
      <div className="border-t border-[var(--line)] p-3">{footer}</div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-[var(--line)] bg-[var(--surf)] lg:block">
        {body}
      </aside>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu"
        className="btn btn-sm -ml-1 border-transparent px-2 lg:hidden">
        <Icon name="menu" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-[var(--line)] bg-[var(--surf)] shadow-xl">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu"
              className="btn btn-sm absolute right-3 top-4 border-transparent px-2">
              <Icon name="x" />
            </button>
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
