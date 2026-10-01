import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import Reveal from "@/components/Reveal";
import Pager from "@/components/Pager";

const PAGE_SIZE = 10;

const FIX_MESSAGES: Record<string, { title: string; steps: string }> = {
  firewall: {
    title: "firewall is off",
    steps:
      "Turn it on in Windows Security, then open Firewall and network protection. This flag clears automatically when we next sync.",
  },
  os_patch: {
    title: "operating system needs an update",
    steps: "Install the latest OS security updates, then restart.",
  },
  antivirus: {
    title: "antivirus is off",
    steps: "Turn on your antivirus or endpoint protection.",
  },
  disk_encryption: {
    title: "disk is not encrypted",
    steps: "Turn on BitLocker (Windows) or FileVault (macOS).",
  },
};

const SEVERITY_CLASS: Record<string, string> = {
  low: "pill",
  medium: "pill w",
  high: "pill b",
  critical: "pill b",
};

export default async function ContributorSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const profile = await getProfile();
  const supabase = await createClient();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { data: devices } = await supabase
    .from("devices")
    .select("id, name")
    .eq("user_id", profile!.id);
  const deviceIds = (devices ?? []).map((d) => d.id);
  const deviceName = new Map((devices ?? []).map((d) => [d.id, d.name]));

  const { data: flags } = deviceIds.length
    ? await supabase
        .from("security_flags")
        .select("*")
        .in("device_id", deviceIds)
        .eq("status", "open")
        .order("first_seen", { ascending: false })
        .range(offset, offset + PAGE_SIZE)
    : { data: [] };

  const openFlags = (flags ?? []).slice(0, PAGE_SIZE);
  const hasNext = (flags ?? []).length > PAGE_SIZE;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Security</h2>
        <p className="text-sm text-[var(--mut)]">
          The agent reports simple yes/no posture checks (never files or
          browsing). Flagged devices are kept out of sensitive work until
          fixed.
        </p>
      </div>

      <Reveal className="card">
        <h3 className="mb-3 text-sm font-bold">Your flags</h3>
        {!openFlags.length ? (
          <p className="text-sm text-[var(--mut)]">
            No open flags on your devices.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--mut)]">
                  <th className="border-b border-[var(--line)] py-2 font-medium">Device</th>
                  <th className="border-b border-[var(--line)] py-2 font-medium">Category</th>
                  <th className="border-b border-[var(--line)] py-2 font-medium">Severity</th>
                  <th className="border-b border-[var(--line)] py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {openFlags.map((flag) => (
                  <tr key={flag.id}>
                    <td className="border-b border-[var(--line)] py-2">
                      {deviceName.get(flag.device_id) ?? "Unknown device"}
                    </td>
                    <td className="border-b border-[var(--line)] py-2">{flag.category}</td>
                    <td className="border-b border-[var(--line)] py-2">
                      <span className={SEVERITY_CLASS[flag.severity] ?? "pill"}>
                        {flag.severity}
                      </span>
                    </td>
                    <td className="border-b border-[var(--line)] py-2">{flag.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} hasNext={hasNext} basePath="/dashboard/security" />
      </Reveal>

      {openFlags.map((flag, i) => {
        const fix = FIX_MESSAGES[flag.category];
        const device = deviceName.get(flag.device_id) ?? "your device";
        return (
          <Reveal key={flag.id} delay={0.06 + i * 0.06} className="card">
            <div className="mb-2 rounded-lg border border-[var(--bad)] px-3 py-2 text-sm text-[var(--bad)]">
              Your {fix?.title ?? flag.detail} on {device}.
            </div>
            <p className="mb-2 text-sm text-[var(--mut)]">
              {fix?.steps ??
                "Check the device for the issue described above. This flag clears automatically when we next sync."}
            </p>
            <p className="text-sm text-[var(--mut)]">
              Until then, this device is kept out of sensitive jobs. Your
              earnings are not affected.
            </p>
          </Reveal>
        );
      })}
    </div>
  );
}
