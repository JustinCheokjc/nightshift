"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}
function daysAgo(d: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
}

const DEVICE_SEEDS = [
  {
    name: "Laptop 1",
    os: "Windows 11",
    cpu_model: "Ryzen 7 7840U",
    cores: 8,
    gpu_model: "Radeon 780M",
    vram_gb: 2,
    ram_gb: 16,
    benchmark_score: 1180,
    status: "idle" as const,
  },
  {
    name: "Workstation",
    os: "macOS 14",
    cpu_model: "Apple M3 Pro",
    cores: 12,
    gpu_model: "M3 Pro GPU",
    vram_gb: 18,
    ram_gb: 32,
    benchmark_score: 2460,
    status: "in_use" as const,
  },
];

// Last 24h, hours expressed as negative offsets from now: overnight idle,
// workday in use, a short idle lunch, evening idle again — mirrors the
// "day in 30 seconds" story on the marketing landing page.
const DAY_SEGMENTS = [
  { fromH: -24, toH: -16, type: "usable_idle" },
  { fromH: -16, toH: -15.5, type: "in_use" },
  { fromH: -15.5, toH: -8, type: "in_use" },
  { fromH: -8, toH: -7.5, type: "usable_idle" },
  { fromH: -7.5, toH: -1, type: "in_use" },
  { fromH: -1, toH: 0, type: "usable_idle" },
];

export async function seedDemoData() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo data seeding is disabled in production.");
  }
  const user = await requireUser();
  const admin = createAdminClient();

  // Idempotent: wipe this user's previous demo rows first (cascades to
  // sessions/daily_summary/device_posture/security_flags/device_settings).
  const { data: existingDevices } = await admin
    .from("devices")
    .select("id")
    .eq("user_id", user.id);
  const deviceIds = (existingDevices ?? []).map((d) => d.id);
  if (deviceIds.length) {
    await admin.from("devices").delete().in("id", deviceIds);
  }
  await admin.from("wallet_accounts").delete().eq("user_id", user.id);
  await admin.from("wallet_accounts").insert({ user_id: user.id });

  const { data: devices, error: devErr } = await admin
    .from("devices")
    .insert(
      DEVICE_SEEDS.map((d) => ({
        ...d,
        user_id: user.id,
        agent_version: "0.3.0-demo",
      }))
    )
    .select();
  if (devErr || !devices) {
    throw new Error(devErr?.message ?? "Failed to seed devices");
  }

  for (const device of devices) {
    await admin.from("device_settings").insert({
      device_id: device.id,
      idle_threshold_min: 5,
      cpu_threshold_pct: 20,
      blackout_windows: [],
    });

    await admin.from("sessions").insert(
      DAY_SEGMENTS.map((s) => ({
        device_id: device.id,
        start_ts: hoursAgo(-s.fromH),
        end_ts: hoursAgo(-s.toH),
        type: s.type,
      }))
    );

    await admin.from("daily_summary").insert(
      Array.from({ length: 7 }).map((_, i) => {
        const idleHours = 5 + Math.round(Math.random() * 20) / 10;
        return {
          device_id: device.id,
          date: daysAgo(i),
          usable_idle_hours: idleHours,
          core_hours: Math.round(idleHours * device.cores * 0.75 * 10) / 10,
          uptime_hours: 16 + Math.round(Math.random() * 4),
        };
      })
    );

    await admin.from("device_posture").insert({
      device_id: device.id,
      os_patch_age_days: device.name === "Laptop 1" ? 12 : 4,
      firewall_on: device.name !== "Laptop 1",
      antivirus_on: true,
      disk_encrypted: true,
      agent_hash_ok: true,
      is_vm: false,
    });
  }

  await admin.from("security_flags").insert({
    device_id: devices[0].id,
    category: "firewall",
    severity: "medium",
    detail: "Firewall is off",
    status: "open",
  });

  await admin.from("audit_log").insert([
    {
      actor: user.email ?? "contributor",
      action: "Loaded demo data",
      target: "account",
    },
    {
      actor: "system",
      action: "Flagged device for open firewall",
      target: devices[0].name,
    },
  ]);

  await admin.from("ledger_entries").insert([
    { account_id: user.id, type: "pilot_payment", amount: 20, status: "paid" },
    {
      account_id: user.id,
      type: "uptime_bonus",
      amount: 6.2,
      status: "available",
    },
    { account_id: user.id, type: "job_earning", amount: 1.7, status: "pending" },
  ]);

  // Fleet-wide aggregate (shared, admin-only table) — seed once.
  const { data: existingFleet } = await admin
    .from("fleet_hourly")
    .select("ts")
    .limit(1);
  if (!existingFleet?.length) {
    const now = new Date();
    const rows = Array.from({ length: 24 }).map((_, h) => {
      const ts = new Date(now);
      ts.setMinutes(0, 0, 0);
      ts.setHours(h);
      const nightBoost = h >= 23 || h < 7 ? 1.6 : h >= 7 && h < 9 ? 1.1 : 0.6;
      const devicesOnline = Math.round(60 + Math.random() * 20);
      const devicesUsable = Math.min(
        Math.round(devicesOnline * 0.5 * nightBoost),
        devicesOnline
      );
      return {
        ts: ts.toISOString(),
        devices_online: devicesOnline,
        devices_usable: devicesUsable,
        core_hours_available: Math.round(devicesUsable * 6.4 * 10) / 10,
      };
    });
    await admin.from("fleet_hourly").insert(rows);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wallet");
  revalidatePath("/dashboard/security");
  revalidatePath("/admin");
  revalidatePath("/admin/security");
}
