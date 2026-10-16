import type { Metadata } from "next";
import { connection } from "next/server";
import AppShell from "@/components/AppShell";
import type { NavGroup } from "@/components/SidebarNav";
import { demoActivity } from "@/lib/demoData";

export const metadata: Metadata = {
  title: "Live demo · Nightshift",
  description: "Explore the Nightshift contributor dashboard with sample devices. No sign-in needed.",
};

const groups: NavGroup[] = [
  {
    items: [
      { href: "/demo", label: "Devices", icon: "devices" },
      { href: "/demo/market", label: "Market", icon: "market" },
      { href: "/demo/wallet", label: "Wallet", icon: "wallet" },
      { href: "/demo/security", label: "Security", icon: "shield" },
    ],
  },
];

// Public, read-only dashboard with sample data, for judges and visitors.
export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  await connection(); // sample data is generated per request, relative to now
  return (
    <AppShell area="Demo" groups={groups} email="demo" role="demo" activity={demoActivity()} demo>
      {children}
    </AppShell>
  );
}
