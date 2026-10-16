import { signOut } from "@/app/actions/auth";
import SidebarNav, { PageTitle, type NavGroup } from "@/components/SidebarNav";
import PageTransition from "@/components/PageTransition";
import ActivityBell, { type ActivityEvent } from "@/components/ActivityBell";
import ThemeToggle from "@/components/ThemeToggle";
import Icon from "@/components/Icon";

const SITE = "https://nightshift-sg.vercel.app";

// The header renders twice (desktop sidebar + mobile drawer), so the mark uses no
// SVG ids: duplicate gradient/mask ids would resolve to the hidden copy.
function LogoMark() {
  return (
    <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-[8px] bg-gradient-to-br from-[#14A394] to-[#0A5E55]" aria-hidden="true">
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full">
        {/* Crescent: circle (22,26,r12) minus circle (31,19,r10), as in the login page mark. */}
        <path d="M22.336 14.005A12 12 0 1 0 33.708 28.627A10 10 0 0 1 22.336 14.005Z" fill="#fff" />
        <circle cx="34.5" cy="13.5" r="2.4" fill="#BFF3EA" />
      </svg>
    </span>
  );
}

/** Sidebar + top bar layout shared by the contributor and operator dashboards. */
export default function AppShell({ area, groups, email, role, activity, children, demo = false }: {
  area: string;
  groups: NavGroup[];
  email: string;
  role: string;
  activity: ActivityEvent[];
  children: React.ReactNode;
  /** Public demo: sample data, no account. Shows a banner and a sign-in button instead of the account menu. */
  demo?: boolean;
}) {
  const initial = (email[0] ?? "?").toUpperCase();

  const header = (
    <a href={SITE} className="flex items-center gap-2.5" title="Nightshift website">
      <LogoMark />
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-tight tracking-tight">Nightshift</span>
        <span className="block text-xs text-[var(--mut)]">{area}</span>
      </span>
    </a>
  );

  const footer = demo ? (
    <div className="flex flex-col gap-2 p-1">
      <p className="text-xs text-[var(--mut)]">You&apos;re exploring a demo with sample data.</p>
      <a href="/login" className="btn btn-primary w-full">Sign in</a>
    </div>
  ) : (
    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--idle)_16%,transparent)] text-xs font-semibold text-[var(--idle)]">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium" title={email}>{email}</span>
        <span className="block text-xs capitalize text-[var(--mut)]">{role}</span>
      </span>
      <form action={signOut}>
        <button type="submit" className="btn btn-sm border-transparent px-2" aria-label="Sign out" title="Sign out">
          <Icon name="logout" />
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen w-full">
      <div className="lg:pl-60">
        {demo && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-[color-mix(in_srgb,var(--idle)_35%,var(--line))] bg-[color-mix(in_srgb,var(--idle)_10%,var(--bg))] px-5 py-2 text-center text-[13px]">
            <span><b className="font-semibold">Live demo</b> · sample devices and data, refreshed every visit. Nothing you do here is saved.</span>
            <a href="/login" className="font-medium text-[var(--idle)] underline-offset-2 hover:underline">Sign in to use your own laptop →</a>
          </div>
        )}
        {/* No backdrop-filter here: it would trap the fixed sidebar inside the header. */}
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5 lg:px-8">
            <SidebarNav groups={groups} header={header} footer={footer} />
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <span className="hidden text-[var(--mut)] sm:inline">{area}</span>
              <Icon name="chevron" size={14} className="hidden text-[var(--mut)] sm:inline" />
              <PageTitle groups={groups} />
            </div>
            <span className="badge warn hidden md:inline-flex" title={demo ? "Sample data" : "Early-stage pilot. Earnings are estimates."}>{demo ? "Demo" : "Pilot"}</span>
            <ActivityBell events={activity} />
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
