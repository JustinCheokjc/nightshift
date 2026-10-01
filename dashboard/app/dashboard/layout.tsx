import { getProfile } from "@/lib/dal";
import { signOut } from "@/app/actions/auth";
import NavTabs from "@/components/NavTabs";
import PageTransition from "@/components/PageTransition";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  const tabs = [
    { href: "/dashboard", label: "Devices" },
    { href: "/dashboard/wallet", label: "Wallet" },
    { href: "/dashboard/security", label: "Security" },
    ...(profile?.role === "admin" ? [{ href: "/admin", label: "Operator" }] : []),
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
          <div className="flex items-center gap-1">
            <NavTabs tabs={tabs} />
            <form action={signOut}>
              <button
                type="submit"
                className="ml-2 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm"
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
