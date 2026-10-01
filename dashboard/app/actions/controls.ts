"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export async function toggleDevicePause(deviceId: string, paused: boolean) {
  await requireUser();
  const supabase = await createClient();
  await supabase
    .from("devices")
    .update({ status: paused ? "offline" : "idle" })
    .eq("id", deviceId);
  revalidatePath("/dashboard");
}

export async function updateIdleThreshold(deviceId: string, formData: FormData) {
  await requireUser();
  const minutes = Number(formData.get("minutes"));
  if (Number.isNaN(minutes) || minutes < 1 || minutes > 30) return;

  const supabase = await createClient();
  await supabase
    .from("device_settings")
    .update({ idle_threshold_min: minutes })
    .eq("device_id", deviceId);
  revalidatePath("/dashboard");
}

export async function updateElectricityRate(formData: FormData) {
  const user = await requireUser();
  const rate = Number(formData.get("rate"));
  if (Number.isNaN(rate) || rate < 0) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ electricity_rate: rate })
    .eq("id", user.id);
  revalidatePath("/dashboard");
}

export async function deleteMyData() {
  const user = await requireUser();
  const supabase = await createClient();
  // Cascades to sessions, daily_summary, device_posture, security_flags,
  // device_settings, telemetry, and (via wallet_accounts) ledger_entries.
  await supabase.from("devices").delete().eq("user_id", user.id);
  await supabase.from("wallet_accounts").delete().eq("user_id", user.id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wallet");
  revalidatePath("/dashboard/security");
}
