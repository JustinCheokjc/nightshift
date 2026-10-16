import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { updateElectricityRate } from "@/app/actions/controls";
import { DEFAULT_ELECTRICITY_RATE } from "@/lib/estimates";
import PageHeader from "@/components/PageHeader";
import DangerZone from "@/components/DangerZone";
import Icon from "@/components/Icon";
import { ThemePicker } from "@/components/ThemeToggle";

const LATEST_AGENT = "0.4.0";
const SITE = "https://nightshift-sg.vercel.app";
const older = (v: string | null, than: string) => {
  if (!v) return true;
  const a = v.split(".").map(Number), b = than.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" });

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-[var(--mut)]">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default async function SettingsPage() {
  const profile = await getProfile();
  const supabase = await createClient();
  const [{ data: devices }, { data: consent }] = await Promise.all([
    supabase.from("devices").select("id, name, agent_version").eq("user_id", profile!.id).order("enrolled_at"),
    supabase.from("consent_log").select("version, accepted_at").eq("user_id", profile!.id).order("accepted_at", { ascending: false }).limit(1),
  ]);
  const outdated = (devices ?? []).filter((d) => older(d.agent_version, LATEST_AGENT));
  const isAdmin = profile?.role === "admin";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Settings" description="Your account, preferences and data." />

      <section className="card">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--idle)_16%,transparent)] text-lg font-semibold text-[var(--idle)]">
            {(profile?.email?.[0] ?? "?").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {profile?.email}
              <span className={`badge ${isAdmin ? "ok" : ""}`}>{isAdmin ? "Admin" : "Contributor"}</span>
            </p>
            {profile?.created_at && <p className="text-xs text-[var(--mut)]">Member since {fmtDate(profile.created_at)}</p>}
          </div>
          <form action={signOut}><button type="submit" className="btn"><Icon name="logout" size={14} /> Sign out</button></form>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title mb-4">Preferences</h2>
        <div className="divide-y divide-[var(--line)]">
          <Row label="Theme" hint="Dark is the default. Saved in this browser.">
            <ThemePicker />
          </Row>
          <Row label="Electricity rate" hint="Used for the electricity estimates on the Devices and Wallet pages.">
            <form action={updateElectricityRate} className="flex items-center gap-2">
              <label htmlFor="rate" className="sr-only">S$ per kWh</label>
              <div className="relative">
                <input id="rate" name="rate" type="text" inputMode="decimal" defaultValue={profile?.electricity_rate ?? DEFAULT_ELECTRICITY_RATE} className="input w-36 pr-16" />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--mut)]">S$/kWh</span>
              </div>
              <button type="submit" className="btn">Save</button>
            </form>
          </Row>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Agent</h2>
        <p className="card-sub mb-4">The latest agent is version {LATEST_AGENT}. It adds safety checks for the Security tab.</p>
        {!devices?.length ? (
          <p className="text-sm text-[var(--mut)]">No devices yet. <a href="/dashboard#add-device" className="text-[var(--idle)] hover:underline">Add your first device</a>.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--line)]">
            {devices.map((d) => {
              const old = older(d.agent_version, LATEST_AGENT);
              return (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <a href={`/dashboard/devices/${d.id}`} className="font-medium hover:underline">{d.name}</a>
                  <span className={`badge ${old ? "warn" : "ok"}`}>{old ? `Update available (v${d.agent_version ?? "?"})` : `Up to date (v${d.agent_version})`}</span>
                </li>
              );
            })}
          </ul>
        )}
        {outdated.length > 0 && (
          <p className="mt-4 rounded-lg bg-[var(--bg)] px-3 py-2.5 text-xs text-[var(--mut)]">
            To update: download the agent from <a href="/dashboard#add-device" className="text-[var(--idle)] hover:underline">Add a device</a>,
            close the old agent, then open the new one and accept the updated privacy notice. It keeps your connection, so there&apos;s no need for a new setup key.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title mb-4">Privacy and data</h2>
        <div className="divide-y divide-[var(--line)]">
          <Row label="Download my data" hint="Devices, sessions, daily summaries, security flags and wallet entries, as one JSON file.">
            <a href="/dashboard/export" className="btn"><Icon name="download" size={14} /> Download</a>
          </Row>
          <Row label="Privacy notice"
            hint={consent?.[0] ? `You accepted version ${consent[0].version} on ${fmtDate(consent[0].accepted_at)}.` : "Accepted in the agent when you add a device."}>
            <a href={`${SITE}/trust/`} target="_blank" rel="noreferrer" className="btn">Read it <Icon name="external" size={13} /></a>
          </Row>
        </div>
      </section>

      <DangerZone />
    </div>
  );
}
