import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { sumBy } from "@/lib/strip";
import SimWallet from "@/components/SimWallet";
import Reveal from "@/components/Reveal";
import Pager from "@/components/Pager";
import PageHeader from "@/components/PageHeader";
import { since30Days } from "@/lib/time";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  available: "Available",
  processing: "Processing",
  paid: "Paid",
  reversed: "Reversed",
};

const STATUS_TONE: Record<string, string> = { pending: "warn", available: "ok", processing: "warn", paid: "", reversed: "bad" };

const TYPE_LABEL: Record<string, string> = {
  pilot_payment: "Pilot completion payment",
  uptime_bonus: "Uptime bonus",
  job_earning: "Job earnings (planned)",
};

const PAGE_SIZE = 10;


export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const profile = await getProfile();
  const supabase = await createClient();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const since = since30Days();
  const { data: devices } = await supabase
    .from("devices")
    .select("id,name,cores")
    .eq("user_id", profile!.id)
    .order("enrolled_at");
  const deviceIds = (devices ?? []).map((d) => d.id);

  const [{ data: allForSums }, { data: pageEntries }, { data: summaries }] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("amount,status")
      .eq("account_id", profile!.id),
    supabase
      .from("ledger_entries")
      .select("*")
      .eq("account_id", profile!.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE),
    deviceIds.length
      ? supabase
          .from("daily_summary")
          .select("device_id,date,usable_idle_hours,core_hours")
          .in("device_id", deviceIds)
          .gte("date", since)
      : Promise.resolve({ data: [] }),
  ]);

  const rows = (pageEntries ?? []).slice(0, PAGE_SIZE);
  const hasNext = (pageEntries ?? []).length > PAGE_SIZE;

  const sumsBase = allForSums ?? [];
  const available = sumBy(
    sumsBase.filter((r) => r.status === "available"),
    (r) => r.amount
  );
  const pending = sumBy(
    sumsBase.filter((r) => r.status === "pending"),
    (r) => r.amount
  );
  const paid = sumBy(
    sumsBase.filter((r) => r.status === "paid"),
    (r) => r.amount
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Wallet"
        description="What your idle hours would earn once paid jobs run. Final terms are in the consent form."
        actions={<span className="badge warn">Simulated · no real money</span>}
      />

      <SimWallet
        userId={profile!.id}
        devices={devices ?? []}
        summaries={summaries ?? []}
        electricityRate={Number(profile?.electricity_rate ?? 0.31)}
      />

      {(rows.length > 0 || page > 1) && (
      <Reveal className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title">Pilot payments</h3>
            <p className="card-sub">
              Recorded ledger: {"S$" + available.toFixed(2)} available, {"S$" + pending.toFixed(2)} pending, {"S$" + paid.toFixed(2)} paid.
            </p>
          </div>
          {rows.length > 0 && (
            <a
              href="/dashboard/wallet/export"
              className="btn btn-sm"
            >
              Export CSV
            </a>
          )}
        </div>
        <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead><tr><th>Entry</th><th>Date</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{TYPE_LABEL[entry.type] ?? entry.type}</td>
                    <td className="text-[var(--mut)]">{new Date(entry.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" })}</td>
                    <td className="text-right tabular-nums">S${Number(entry.amount).toFixed(2)}</td>
                    <td><span className={`badge ${STATUS_TONE[entry.status] ?? ""}`}>{STATUS_LABEL[entry.status] ?? entry.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
        <Pager page={page} hasNext={hasNext} basePath="/dashboard/wallet" />
      </Reveal>
      )}
    </div>
  );
}
