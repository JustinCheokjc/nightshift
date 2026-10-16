import { getProfile } from "@/lib/dal";
import { getContributorActivity } from "@/lib/activity";
import AppShell from "@/components/AppShell";
import type { NavGroup } from "@/components/SidebarNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  const activity = await getContributorActivity(profile!.id);

  const groups: NavGroup[] = [
    {
      items: [
        { href: "/dashboard", label: "Devices", icon: "devices" },
        { href: "/dashboard/market", label: "Market", icon: "market" },
        { href: "/dashboard/wallet", label: "Wallet", icon: "wallet" },
        { href: "/dashboard/security", label: "Security", icon: "shield" },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/dashboard/settings", label: "Settings", icon: "settings" },
        ...(isAdmin ? [{ href: "/admin", label: "Operator console", icon: "fleet" as const }] : []),
      ],
    },
  ];

  return (
    <AppShell area="Contributor" groups={groups} email={profile?.email ?? ""} role={profile?.role ?? "contributor"} activity={activity}>
      {children}
    </AppShell>
  );
}
