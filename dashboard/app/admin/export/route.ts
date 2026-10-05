import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: flags } = await supabase
    .from("security_flags")
    .select("device_id,category,severity,detail,status,first_seen")
    .order("first_seen", { ascending: false });

  const deviceIds = [...new Set((flags ?? []).map((f) => f.device_id))];
  const { data: devices } = deviceIds.length
    ? await supabase.from("devices").select("id,name").in("id", deviceIds)
    : { data: [] };
  const deviceName = new Map((devices ?? []).map((d) => [d.id, d.name]));

  const rows = (flags ?? []).map((f) => ({
    device: deviceName.get(f.device_id) ?? f.device_id,
    category: f.category,
    severity: f.severity,
    detail: f.detail,
    status: f.status,
    first_seen: f.first_seen,
  }));

  const csv = toCsv(rows, [
    "device",
    "category",
    "severity",
    "detail",
    "status",
    "first_seen",
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        'attachment; filename="nightshift-security-flags.csv"',
    },
  });
}
