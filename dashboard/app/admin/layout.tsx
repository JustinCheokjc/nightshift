import { requireAdmin } from "@/lib/dal";
import { getAdminActivity } from "@/lib/activity";
import AppShell from "@/components/AppShell";
import type { NavGroup } from "@/components/SidebarNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();
  const activity = await getAdminActivity();

  const groups: NavGroup[] = [
    {
      items: [
        { href: "/admin", label: "Fleet", icon: "fleet" },
        { href: "/admin/security", label: "Security", icon: "shield" },
        { href: "/admin/team", label: "Team", icon: "team" },
      ],
    },
    {
      label: "Switch to",
      items: [{ href: "/dashboard", label: "My dashboard", icon: "home" }],
    },
  ];

  return (
    <AppShell area="Operator" groups={groups} email={profile?.email ?? ""} role={profile?.role ?? "admin"} activity={activity}>
      {children}
    </AppShell>
  );
}
