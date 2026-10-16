import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// Safety checks sent by agent 0.4.0+ every few hours. null means the agent
// couldn't tell, which never opens or closes a flag.
export type Posture = {
  firewall_on: boolean | null;
  antivirus_on: boolean | null;
  disk_encrypted: boolean | null;
  os_patch_age_days: number | null;
};

const STALE_PATCH_DAYS = 30;

export function cleanPosture(raw: unknown): Posture | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const bool = (v: unknown) => (typeof v === "boolean" ? v : null);
  const days = typeof r.os_patch_age_days === "number" && Number.isFinite(r.os_patch_age_days)
    ? Math.min(Math.max(Math.round(r.os_patch_age_days), 0), 3650) : null;
  return { firewall_on: bool(r.firewall_on), antivirus_on: bool(r.antivirus_on), disk_encrypted: bool(r.disk_encrypted), os_patch_age_days: days };
}

type Check = { category: string; failing: boolean | null; severity: "low" | "medium" | "high"; detail: string };

export function postureChecks(p: Posture): Check[] {
  const days = p.os_patch_age_days;
  return [
    { category: "firewall", failing: p.firewall_on === null ? null : !p.firewall_on, severity: "medium",
      detail: "The firewall is turned off for home or public networks" },
    { category: "antivirus", failing: p.antivirus_on === null ? null : !p.antivirus_on, severity: "high",
      detail: "No antivirus has real-time protection turned on" },
    { category: "disk_encryption", failing: p.disk_encrypted === null ? null : !p.disk_encrypted, severity: "medium",
      detail: "The system disk is not encrypted" },
    { category: "os_patch", failing: days === null ? null : days > STALE_PATCH_DAYS, severity: days !== null && days > 90 ? "high" : "medium",
      detail: `The last system update was installed ${days} days ago` },
  ];
}

/** Store a posture reading, then open or resolve one flag per failing or passing check. */
export async function syncPosture(admin: ReturnType<typeof createAdminClient>, deviceId: string, p: Posture) {
  await admin.from("device_posture").insert({ device_id: deviceId, ...p });
  const { data: open } = await admin
    .from("security_flags")
    .select("id, category")
    .eq("device_id", deviceId)
    .eq("status", "open");
  const openBy = new Map((open ?? []).map((f) => [f.category, f.id]));
  const now = new Date().toISOString();

  for (const c of postureChecks(p)) {
    if (c.failing === null) continue;
    const openId = openBy.get(c.category);
    if (c.failing && !openId) {
      await admin.from("security_flags").insert({ device_id: deviceId, category: c.category, severity: c.severity, detail: c.detail });
    } else if (c.failing && openId) {
      await admin.from("security_flags").update({ detail: c.detail, severity: c.severity }).eq("id", openId); // keep it current
    } else if (!c.failing && openId) {
      await admin.from("security_flags").update({ status: "resolved", resolved_at: now }).eq("id", openId);
    }
  }
}
