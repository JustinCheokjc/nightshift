import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: devices } = await supabase
    .from("devices")
    .select("*")
    .eq("user_id", profile!.id);
  const deviceIds = (devices ?? []).map((d) => d.id);

  const [{ data: sessions }, { data: dailySummary }, { data: securityFlags }, { data: ledger }] =
    await Promise.all([
      deviceIds.length
        ? supabase.from("sessions").select("*").in("device_id", deviceIds)
        : Promise.resolve({ data: [] }),
      deviceIds.length
        ? supabase.from("daily_summary").select("*").in("device_id", deviceIds)
        : Promise.resolve({ data: [] }),
      deviceIds.length
        ? supabase.from("security_flags").select("*").in("device_id", deviceIds)
        : Promise.resolve({ data: [] }),
      supabase.from("ledger_entries").select("*").eq("account_id", profile!.id),
    ]);

  const bundle = {
    exported_at: new Date().toISOString(),
    profile: { email: profile!.email, role: profile!.role },
    devices,
    sessions,
    daily_summary: dailySummary,
    security_flags: securityFlags,
    ledger_entries: ledger,
  };

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="nightshift-my-data.json"',
    },
  });
}
