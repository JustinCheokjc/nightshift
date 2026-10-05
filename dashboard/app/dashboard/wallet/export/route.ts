import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("ledger_entries")
    .select("type,amount,status,created_at")
    .eq("account_id", profile!.id)
    .order("created_at", { ascending: false });

  const csv = toCsv(data ?? [], ["type", "amount", "status", "created_at"]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="nightshift-wallet.csv"',
    },
  });
}
