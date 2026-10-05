import { getProfile } from "@/lib/dal";
import { signOut } from "@/app/actions/auth";
import { getContributorActivity } from "@/lib/activity";
import NavTabs from "@/components/NavTabs";
import PageTransition from "@/components/PageTransition";
import CommandPalette from "@/components/CommandPalette";
import ActivityBell from "@/components/ActivityBell";
import ThemeToggle from "@/components/ThemeToggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  const activity = await getContributorActivity(profile!.id);

  const tabs = [
    { href: "/dashboard", label: "Devices" },
    { href: "/dashboard/wallet", label: "Wallet" },
    { href: "/dashboard/security", label: "Security" },
    { href: "/dashboard/settings", label: "Settings" },
    ...(isAdmin ? [{ href: "/admin", label: "Operator" }] : []),
  ];

  const commandItems = [
    ...tabs.map((t) => ({ label: t.label, href: t.href })),
    { label: "Sign out", onSelect: signOut },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div>
            <h1 className="text-lg font-bold">Nightshift</h1>
            <p className="text-xs text-[var(--mut)]">
              Contributor dashboard
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NavTabs tabs={tabs} />
            <CommandPalette items={commandItems} />
            <ActivityBell events={activity} />
            <ThemeToggle />
            <form action={signOut}>
              <button
                type="submit"
                className="ml-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
