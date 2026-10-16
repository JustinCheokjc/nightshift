import { createClient } from "@/lib/supabase/server";
import Reveal from "@/components/Reveal";
import Pager from "@/components/Pager";
import PageHeader from "@/components/PageHeader";

const SEVERITY_TONE: Record<string, string> = { low: "", medium: "warn", high: "bad", critical: "bad" };
const CATEGORY: Record<string, string> = { firewall: "Firewall", antivirus: "Antivirus", disk_encryption: "Disk encryption", os_patch: "System updates" };
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

const PAGE_SIZE = 10;

export default async function OperatorSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ flagsPage?: string; auditPage?: string }>;
}) {
  const supabase = await createClient();
  const { flagsPage: flagsPageParam, auditPage: auditPageParam } =
    await searchParams;
  const flagsPage = Math.max(1, Number(flagsPageParam) || 1);
  const auditPage = Math.max(1, Number(auditPageParam) || 1);
  const flagsOffset = (flagsPage - 1) * PAGE_SIZE;
  const auditOffset = (auditPage - 1) * PAGE_SIZE;

  const [{ data: allFlagCategories }, { data: pageFlags }, { data: pageAuditLog }] =
    await Promise.all([
      supabase.from("security_flags").select("category"),
      supabase
        .from("security_flags")
        .select("*")
        .order("first_seen", { ascending: false })
        .range(flagsOffset, flagsOffset + PAGE_SIZE),
      supabase
        .from("audit_log")
        .select("*")
        .order("ts", { ascending: false })
        .range(auditOffset, auditOffset + PAGE_SIZE),
    ]);

  const flags = (pageFlags ?? []).slice(0, PAGE_SIZE);
  const flagsHasNext = (pageFlags ?? []).length > PAGE_SIZE;
  const auditLog = (pageAuditLog ?? []).slice(0, PAGE_SIZE);
  const auditHasNext = (pageAuditLog ?? []).length > PAGE_SIZE;

  const deviceIds = [...new Set(flags.map((f) => f.device_id))];
  const { data: devices } = deviceIds.length
    ? await supabase.from("devices").select("id, name").in("id", deviceIds)
    : { data: [] };
  const deviceName = new Map((devices ?? []).map((d) => [d.id, d.name]));

  const byCategory = new Map<string, number>();
  for (const f of allFlagCategories ?? []) {
    byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
  }

  const total = [...byCategory.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Security" description="Fleet-wide safety checks, reported by the agent on each device every 6 hours."
        actions={flags.length ? <a href="/admin/export" className="btn">Export CSV</a> : undefined} />

      <Reveal className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Flags</h2>
            <p className="card-sub">Open flags close automatically when the device&apos;s next check passes.</p>
          </div>
        </div>
        {!flags.length ? (
          <p className="py-6 text-center text-sm text-[var(--mut)]">No flags reported yet.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="table table-sm min-w-[720px]">
              <thead><tr><th>Device</th><th>Check</th><th>Severity</th><th>Detail</th><th>Found</th><th>Status</th></tr></thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.id}>
                    <td className="whitespace-nowrap font-medium">{deviceName.get(flag.device_id) ?? "Unknown device"}</td>
                    <td className="whitespace-nowrap">{CATEGORY[flag.category] ?? flag.category}</td>
                    <td><span className={`badge ${SEVERITY_TONE[flag.severity] ?? ""}`}>{cap(flag.severity)}</span></td>
                    <td className="text-[var(--mut)]">{flag.detail}</td>
                    <td className="whitespace-nowrap text-[var(--mut)]">{new Date(flag.first_seen).toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" })}</td>
                    <td><span className={`badge ${flag.status === "open" ? "warn" : "ok"}`}>{cap(flag.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={flagsPage} hasNext={flagsHasNext} basePath="/admin/security" paramName="flagsPage" />
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="card">
          <h2 className="card-title mb-3">Flags by check</h2>
          {!byCategory.size ? (
            <p className="text-sm text-[var(--mut)]">No flags yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {[...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <li key={cat} className="text-[13px]">
                  <div className="flex justify-between"><span>{CATEGORY[cat] ?? cat}</span><b className="font-semibold tabular-nums">{count}</b></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--sleep)]"><div className="h-full rounded-full bg-[var(--amber)]" style={{ width: `${(count / total) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
          <h2 className="card-title mb-3 mt-6">Response by severity</h2>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-[13px]">
            {([["Low", "", "Note to the contributor, no restriction"], ["Medium", "warn", "Fix prompt, kept out of sensitive jobs"],
              ["High", "bad", "Device paused, operator review"], ["Critical", "bad", "Token revoked, jobs stopped, incident logged"]] as [string, string, string][]).map(([l, t, d]) => (
              <div key={l} className="contents"><dt><span className={`badge ${t}`}>{l}</span></dt><dd className="text-[var(--mut)]">{d}</dd></div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={0.06} className="card">
          <h2 className="card-title mb-3">Audit log</h2>
          {!auditLog.length ? (
            <p className="text-sm text-[var(--mut)]">No audit events yet.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-[var(--line)]">
              {auditLog.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <b className="font-medium">{entry.action}</b>
                    <span className="block truncate text-xs text-[var(--mut)]">{entry.actor}{entry.target ? ` → ${entry.target}` : ""}</span>
                  </span>
                  <time className="shrink-0 text-xs tabular-nums text-[var(--mut)]">
                    {new Date(entry.ts).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore" })}
                  </time>
                </li>
              ))}
            </ol>
          )}
          <Pager page={auditPage} hasNext={auditHasNext} basePath="/admin/security" paramName="auditPage" />
        </Reveal>
      </div>
    </div>
  );
}
