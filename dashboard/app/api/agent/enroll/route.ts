import { createAdminClient } from "@/lib/supabase/admin";
import { createDeviceToken, readSetupKey } from "@/lib/agentAuth";

const OS_FAMILIES = ["windows", "macos", "linux"];

function text(v: unknown, max = 120) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}
function num(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

// Agent first run: swap a setup key from the dashboard for a device token.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const setup = body && readSetupKey(String(body.setup_key ?? ""));
  if (!setup) {
    return Response.json(
      { error: "This setup key is invalid or has expired. Create a new one under Add a device on the dashboard." },
      { status: 401 }
    );
  }
  const d = body.device ?? {};
  if (!OS_FAMILIES.includes(d.os_family)) {
    return Response.json({ error: "Unsupported operating system." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", setup.userId)
    .single();
  if (!profile) {
    return Response.json({ error: "The account for this setup key no longer exists." }, { status: 401 });
  }

  const { data: device, error } = await admin
    .from("devices")
    .insert({
      user_id: profile.id,
      name: text(d.name, 60) ?? "My computer",
      os: text(d.os, 60) ?? d.os_family,
      cpu_model: text(d.cpu_model),
      cores: num(d.cores),
      gpu_model: text(d.gpu_model),
      ram_gb: num(d.ram_gb),
      agent_version: text(d.agent_version, 30),
      status: "online",
    })
    .select("id, name")
    .single();
  if (error || !device) {
    return Response.json({ error: "Could not register this device. Try again." }, { status: 500 });
  }

  await admin.from("device_settings").insert({
    device_id: device.id,
    idle_threshold_min: 5,
    cpu_threshold_pct: 20,
    blackout_windows: [],
  });
  await admin.from("consent_log").insert({ user_id: profile.id, version: text(body.consent_version, 20) ?? "agent-1" });
  await admin.from("audit_log").insert({ actor: "agent", action: "Enrolled device", target: device.name });

  return Response.json({ device_id: device.id, name: device.name, token: createDeviceToken(device.id) });
}
