import { getProfile } from "@/lib/dal";
import Reveal from "@/components/Reveal";

export default async function SettingsPage() {
  const profile = await getProfile();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-[var(--mut)]">
          Your account and data.
        </p>
      </div>

      <Reveal className="card">
        <h3 className="mb-3 text-sm font-bold">Profile</h3>
        <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
          <dt className="text-[var(--mut)]">Email</dt>
          <dd>{profile?.email}</dd>
          <dt className="text-[var(--mut)]">Role</dt>
          <dd>
            <span className={`pill ${profile?.role === "admin" ? "i" : ""}`}>
              {profile?.role}
            </span>
          </dd>
        </dl>
      </Reveal>

      <Reveal delay={0.06} className="card">
        <h3 className="mb-2 text-sm font-bold">Your data</h3>
        <p className="mb-3 text-sm text-[var(--mut)]">
          Download everything Nightshift has stored about you — devices,
          sessions, daily summaries, security flags, and wallet entries — as
          one JSON file.
        </p>
        <a
          href="/dashboard/export"
          className="inline-block rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
        >
          Download my data
        </a>
      </Reveal>
    </div>
  );
}
