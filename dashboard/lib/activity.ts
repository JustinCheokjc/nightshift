import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ActivityEvent } from "@/components/ActivityBell";

export async function getContributorActivity(
  userId: string
): Promise<ActivityEvent[]> {
  const supabase = await createClient();
  const { data: devices } = await supabase
    .from("devices")
    .select("id,name")
    .eq("user_id", userId);
  const deviceIds = (devices ?? []).map((d) => d.id);
  const deviceName = new Map((devices ?? []).map((d) => [d.id, d.name]));

  const [{ data: flags }, { data: ledger }] = await Promise.all([
    deviceIds.length
      ? supabase
          .from("security_flags")
          .select("id,category,detail,first_seen,device_id")
          .in("device_id", deviceIds)
          .order("first_seen", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("ledger_entries")
      .select("id,type,status,amount,created_at")
      .eq("account_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const events: ActivityEvent[] = [];
  for (const f of flags ?? []) {
    events.push({
      id: `flag-${f.id}`,
      label: `Security flag: ${f.category}`,
      detail: `${deviceName.get(f.device_id) ?? "Device"} — ${f.detail ?? ""}`,
      ts: f.first_seen,
    });
  }
  for (const l of ledger ?? []) {
    events.push({
      id: `ledger-${l.id}`,
      label: `Wallet: ${l.type.replace(/_/g, " ")}`,
      detail: `S$${Number(l.amount).toFixed(2)} — ${l.status}`,
      ts: l.created_at,
    });
  }
  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return events.slice(0, 8);
}

export async function getAdminActivity(): Promise<ActivityEvent[]> {
  const supabase = await createClient();
  const { data: audit } = await supabase
    .from("audit_log")
    .select("id,actor,action,target,ts")
    .order("ts", { ascending: false })
    .limit(8);
  return (audit ?? []).map((a) => ({
    id: `audit-${a.id}`,
    label: a.action,
    detail: `${a.actor}${a.target ? ` → ${a.target}` : ""}`,
    ts: a.ts,
  }));
}
