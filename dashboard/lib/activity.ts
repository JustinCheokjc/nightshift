import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ActivityEvent } from "@/components/ActivityBell";

const QUIET_MS = 24 * 3600 * 1000;

export async function getContributorActivity(
  userId: string
): Promise<ActivityEvent[]> {
  const supabase = await createClient();
  const { data: devices } = await supabase
    .from("devices")
    .select("id,name,status,enrolled_at")
    .eq("user_id", userId);
  const deviceIds = (devices ?? []).map((d) => d.id);
  const deviceName = new Map((devices ?? []).map((d) => [d.id, d.name]));

  // Latest reading per device, to warn when one goes quiet.
  const latest = await Promise.all(
    deviceIds.map((id) =>
      supabase.from("telemetry").select("ts").eq("device_id", id).order("ts", { ascending: false }).limit(1).maybeSingle()
    )
  );

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
  const now = Date.now();
  (devices ?? []).forEach((d, i) => {
    events.push({ id: `added-${d.id}`, label: `Device added: ${d.name}`, detail: "Setup key used. The agent is linked to your account.", ts: d.enrolled_at, tone: "info" });
    if (d.status === "offline") return; // paused on purpose
    const last = latest[i].data?.ts;
    const quietSince = last ?? d.enrolled_at;
    if (now - Date.parse(quietSince) > QUIET_MS) {
      events.push({
        id: `quiet-${d.id}-${quietSince}`,
        label: `${d.name} stopped reporting`,
        detail: last ? "No readings for over a day. Check the agent is running and the computer is online." : "No readings since it was added. Open the agent and check it's running.",
        ts: new Date(Date.parse(quietSince) + QUIET_MS).toISOString(),
        tone: "warn",
      });
    }
  });
  for (const f of flags ?? []) {
    events.push({
      id: `flag-${f.id}`,
      label: `Security check failed: ${f.category.replace(/_/g, " ")}`,
      detail: `${deviceName.get(f.device_id) ?? "Device"}: ${f.detail ?? ""}. See the Security tab to fix it.`,
      ts: f.first_seen,
      tone: "bad",
    });
  }
  for (const l of ledger ?? []) {
    events.push({
      id: `ledger-${l.id}`,
      label: `Wallet: ${l.type.replace(/_/g, " ")}`,
      detail: `S$${Number(l.amount).toFixed(2)}, ${l.status}`,
      ts: l.created_at,
      tone: "info",
    });
  }
  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return events.slice(0, 10);
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
