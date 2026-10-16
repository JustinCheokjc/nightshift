import Pager from "@/components/Pager";
import PageHeader from "@/components/PageHeader";
import Icon from "@/components/Icon";

export type Flag = { id: string | number; device_id: string; category: string; severity: string; detail: string | null; first_seen: string };

const FIXES: Record<string, { title: string; steps: string[] }> = {
  firewall: { title: "Firewall is off", steps: ["Open Windows Security → Firewall & network protection.", "Turn the firewall on for your active network."] },
  os_patch: { title: "System updates needed", steps: ["Install the latest operating system security updates.", "Restart the computer when asked."] },
  antivirus: { title: "Antivirus is off", steps: ["Turn on Microsoft Defender or your antivirus.", "Make sure real-time protection is enabled."] },
  disk_encryption: { title: "Disk isn't encrypted", steps: ["Turn on BitLocker (Windows) or FileVault (Mac).", "Keep the recovery key somewhere safe."] },
};
const CHECKS: [string, string][] = [
  ["Firewall", "Blocks unexpected incoming connections."],
  ["System updates", "Security patches are installed."],
  ["Antivirus", "Real-time protection is switched on."],
  ["Disk encryption", "Data on the disk is encrypted at rest."],
];
const TONE: Record<string, string> = { low: "", medium: "warn", high: "bad", critical: "bad" };

/** Security posture for a contributor's devices (live or demo). */
export default function SecurityView({ flags, deviceNames, deviceCount, page = 1, hasNext = false }: {
  flags: Flag[]; deviceNames: Map<string, string>; deviceCount: number; page?: number; hasNext?: boolean;
}) {
  const clear = flags.length === 0 && page === 1;
  const affected = new Set(flags.map((f) => f.device_id)).size;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Security"
        description="The agent reports simple yes/no checks, never files or browsing. Flagged devices are kept out of sensitive work until fixed."
      />

      <section className={`card flex flex-wrap items-center gap-5 ${clear ? "" : "border-[color-mix(in_srgb,var(--amber)_40%,var(--line))]"}`}>
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${clear
          ? "bg-[color-mix(in_srgb,var(--idle)_14%,transparent)] text-[var(--idle)]"
          : "bg-[color-mix(in_srgb,var(--amber)_14%,transparent)] text-[var(--amber)]"}`}>
          <Icon name={clear ? "shield" : "alert"} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{clear ? "All clear" : `${flags.length} issue${flags.length === 1 ? "" : "s"} to fix`}</h2>
          <p className="text-sm text-[var(--mut)]">
            {deviceCount === 0 ? "Add a device to start security checks."
              : clear ? `No open issues across your ${deviceCount} device${deviceCount === 1 ? "" : "s"}.`
              : `On ${affected} of ${deviceCount} device${deviceCount === 1 ? "" : "s"}. Issues clear automatically after the next check passes.`}
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <div><span className="block text-xs text-[var(--mut)]">Devices checked</span><b className="text-lg font-semibold tabular-nums">{deviceCount}</b></div>
          <div><span className="block text-xs text-[var(--mut)]">Open issues</span><b className={`text-lg font-semibold tabular-nums ${clear ? "" : "text-[var(--amber)]"}`}>{flags.length}</b></div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {flags.map((f) => {
            const fix = FIXES[f.category];
            return (
              <section key={f.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="card-title flex items-center gap-2">{fix?.title ?? f.detail ?? f.category}</h3>
                    <p className="card-sub">
                      {deviceNames.get(f.device_id) ?? "Unknown device"}
                      {f.first_seen ? ` · found ${new Date(f.first_seen).toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" })}` : ""}
                    </p>
                  </div>
                  <span className={`badge ${TONE[f.severity] ?? ""}`}>{f.severity.charAt(0).toUpperCase() + f.severity.slice(1)} risk</span>
                </div>
                {f.detail && fix && <p className="mt-3 text-[13px] text-[var(--mut)]">{f.detail}.</p>}
                <ol className="mt-4 flex flex-col gap-2.5">
                  {(fix?.steps ?? ["Check the device for the issue described above."]).map((step, i) => (
                    <li key={i} className="flex gap-3 text-[13px]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[11px] font-semibold text-[var(--mut)]">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 rounded-lg bg-[var(--bg)] px-3 py-2.5 text-xs text-[var(--mut)]">
                  Until it&apos;s fixed, this device is kept out of sensitive jobs. Your idle time still counts.
                </p>
              </section>
            );
          })}
          {clear && (
            <section className="card flex flex-col items-center py-10 text-center">
              <Icon name="check" size={22} className="mb-3 text-[var(--idle)]" />
              <p className="text-sm font-medium">Nothing to fix</p>
              <p className="mt-1 max-w-sm text-sm text-[var(--mut)]">If a check fails, you&apos;ll see the issue here with step-by-step instructions.</p>
            </section>
          )}
          {(page > 1 || hasNext) && <Pager page={page} hasNext={hasNext} basePath="/dashboard/security" />}
        </div>

        <section className="card self-start">
          <h2 className="card-title mb-3">What the agent checks</h2>
          <ul className="flex flex-col gap-3">
            {CHECKS.map(([name, desc]) => (
              <li key={name} className="flex gap-3">
                <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-[var(--mut)]" />
                <div><p className="text-[13px] font-medium">{name}</p><p className="text-xs text-[var(--mut)]">{desc}</p></div>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-[var(--line)] pt-3 text-xs text-[var(--mut)]">
            Only a yes or no is sent for each check. Nightshift never sees your files, browsing or keystrokes.
          </p>
        </section>
      </div>
    </div>
  );
}
