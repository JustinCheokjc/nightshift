import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { sumBy } from "@/lib/strip";
import SimWallet from "@/components/SimWallet";
import Reveal from "@/components/Reveal";
import Pager from "@/components/Pager";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  available: "Available",
  processing: "Processing",
  paid: "Paid",
  reversed: "Reversed",
};

const TYPE_LABEL: Record<string, string> = {
  pilot_payment: "Pilot completion payment",
  uptime_bonus: "Uptime bonus",
  job_earning: "Job earnings (planned)",
};

const PAGE_SIZE = 10;

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

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

  const since = daysAgo(30);
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Wallet</h2>
          <p className="text-sm text-[var(--mut)]">
            What your idle hours would earn once paid jobs run. Final terms are in the consent form.
          </p>
        </div>
        <span className="pill border-[var(--amber)] text-[var(--amber)]">Simulated · no real money</span>
      </div>

      <SimWallet
        userId={profile!.id}
        devices={devices ?? []}
        summaries={summaries ?? []}
        electricityRate={Number(profile?.electricity_rate ?? 0.31)}
      />

      {(rows.length > 0 || page > 1) && (
      <Reveal className="card">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Pilot payments</h3>
            <p className="text-xs text-[var(--mut)]">
              Recorded ledger: {"S$" + available.toFixed(2)} available, {"S$" + pending.toFixed(2)} pending, {"S$" + paid.toFixed(2)} paid.
            </p>
          </div>
          {rows.length > 0 && (
            <a
              href="/dashboard/wallet/export"
              className="rounded-lg border border-[var(--line)] px-3 py-1 text-xs"
            >
              Export CSV
            </a>
          )}
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--mut)]">
                  <th className="border-b border-[var(--line)] py-2 font-medium">
                    Entry
                  </th>
                  <th className="border-b border-[var(--line)] py-2 font-medium">
                    Amount
                  </th>
                  <th className="border-b border-[var(--line)] py-2 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id}>
                    <td className="border-b border-[var(--line)] py-2">
                      {TYPE_LABEL[entry.type] ?? entry.type}
                    </td>
                    <td className="border-b border-[var(--line)] py-2">
                      S${Number(entry.amount).toFixed(2)}
                    </td>
                    <td className="border-b border-[var(--line)] py-2">
                      {STATUS_LABEL[entry.status] ?? entry.status}
                    </td>
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
