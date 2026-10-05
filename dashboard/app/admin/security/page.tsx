import { createClient } from "@/lib/supabase/server";
import Reveal from "@/components/Reveal";
import Pager from "@/components/Pager";

const SEVERITY_CLASS: Record<string, string> = {
  low: "pill",
  medium: "pill w",
  high: "pill b",
  critical: "pill b",
};

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Security</h2>
        <p className="text-sm text-[var(--mut)]">
          Fleet-wide posture flags, reported by the agent on each device.
        </p>
      </div>

      <Reveal className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Flagged devices</h3>
          {!!flags?.length && (
            <a
              href="/admin/export"
              className="rounded-lg border border-[var(--line)] px-3 py-1 text-xs"
            >
              Export CSV
            </a>
          )}
        </div>
        {!flags?.length ? (
          <p className="text-sm text-[var(--mut)]">No flags reported yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--mut)]">
                  <th className="border-b border-[var(--line)] py-2 font-medium">Device</th>
                  <th className="border-b border-[var(--line)] py-2 font-medium">Category</th>
                  <th className="border-b border-[var(--line)] py-2 font-medium">Severity</th>
                  <th className="border-b border-[var(--line)] py-2 font-medium">Reason</th>
                  <th className="border-b border-[var(--line)] py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
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
                    <td className="border-b border-[var(--line)] py-2">{flag.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={flagsPage}
          hasNext={flagsHasNext}
          basePath="/admin/security"
          paramName="flagsPage"
        />
      </Reveal>

      <div className="grid gap-3 sm:grid-cols-2">
        <Reveal className="card">
          <h3 className="mb-3 text-sm font-bold">Flags by category</h3>
          {!byCategory.size ? (
            <p className="text-sm text-[var(--mut)]">No flags yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {[...byCategory.entries()].map(([cat, count]) => (
                <li key={cat} className="flex justify-between border-b border-[var(--line)] py-1">
                  <span>{cat}</span>
                  <span className="text-[var(--mut)]">{count}</span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-5 mb-3 text-sm font-bold">Response by severity</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1"><span className="pill">Low</span></td>
                <td className="py-1 text-[var(--mut)]">Note to contributor, no restriction</td>
              </tr>
              <tr>
                <td className="py-1"><span className="pill w">Medium</span></td>
                <td className="py-1 text-[var(--mut)]">Fix prompt, excluded from sensitive jobs</td>
              </tr>
              <tr>
                <td className="py-1"><span className="pill b">High</span></td>
                <td className="py-1 text-[var(--mut)]">Device paused, operator review</td>
              </tr>
              <tr>
                <td className="py-1"><span className="pill b">Critical</span></td>
                <td className="py-1 text-[var(--mut)]">Token revoked, jobs stopped, incident logged</td>
              </tr>
            </tbody>
          </table>
        </Reveal>

        <Reveal delay={0.08} className="card">
          <h3 className="mb-3 text-sm font-bold">Audit log</h3>
          {!auditLog?.length ? (
            <p className="text-sm text-[var(--mut)]">No audit events yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--mut)]">
                    <th className="border-b border-[var(--line)] py-2 font-medium">Time</th>
                    <th className="border-b border-[var(--line)] py-2 font-medium">Actor</th>
                    <th className="border-b border-[var(--line)] py-2 font-medium">Action</th>
                    <th className="border-b border-[var(--line)] py-2 font-medium">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => (
                    <tr key={entry.id}>
                      <td className="border-b border-[var(--line)] py-2 text-xs text-[var(--mut)]">
                        {new Date(entry.ts).toLocaleString()}
                      </td>
                      <td className="border-b border-[var(--line)] py-2">{entry.actor}</td>
                      <td className="border-b border-[var(--line)] py-2">{entry.action}</td>
                      <td className="border-b border-[var(--line)] py-2">{entry.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager
            page={auditPage}
            hasNext={auditHasNext}
            basePath="/admin/security"
            paramName="auditPage"
          />
        </Reveal>
      </div>
    </div>
  );
}
