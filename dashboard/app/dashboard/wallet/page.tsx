import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { sumBy } from "@/lib/strip";
import Kpi from "@/components/Kpi";
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

  const [{ data: allForSums }, { data: pageEntries }] = await Promise.all([
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
      <div>
        <h2 className="text-xl font-bold">Wallet</h2>
        <p className="text-sm text-[var(--mut)]">
          Estimates only until paid jobs exist. Final terms are in the consent
          form.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi value={available} decimals={2} prefix="S$" label="Available" />
        <Kpi value={pending} decimals={2} prefix="S$" label="Pending" />
        <Kpi value={paid} decimals={2} prefix="S$" label="Paid out" />
      </div>

      <Reveal className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Ledger</h3>
          {rows.length > 0 && (
            <a
              href="/dashboard/wallet/export"
              className="rounded-lg border border-[var(--line)] px-3 py-1 text-xs"
            >
              Export CSV
            </a>
          )}
        </div>
        {!rows.length ? (
          <p className="text-sm text-[var(--mut)]">
            No ledger entries yet. Load demo data from the Devices page to see
            this in action.
          </p>
        ) : (
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
        )}
        <Pager page={page} hasNext={hasNext} basePath="/dashboard/wallet" />
      </Reveal>
    </div>
  );
}
