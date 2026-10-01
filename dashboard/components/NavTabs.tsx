"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export default function NavTabs({
  tabs,
}: {
  tabs: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="relative rounded-lg px-3 py-1.5 text-sm hover:bg-[var(--surf)]"
          >
            {tab.label}
            {active && (
              <motion.span
                layoutId="nav-underline"
                className="absolute inset-x-2 -bottom-[1px] h-[2px] rounded-full bg-[var(--idle)]"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
