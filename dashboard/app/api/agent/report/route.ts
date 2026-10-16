import { createAdminClient } from "@/lib/supabase/admin";
import { readDeviceToken } from "@/lib/agentAuth";
import { sgDate } from "@/lib/time";

// Agent readings, sent every minute (or in a batch after being offline).
// The server decides "usable idle" from the device's settings, so changing
// the threshold on the dashboard takes effect without updating the agent.

type Reading = {
  ts: string;
  plugged_in: boolean | null;
  battery_pct: number | null;
  input_idle_sec: number | null;
  cpu_pct: number | null;
  ram_pct: number | null;
  locked: boolean | null; // screen locked: the person has stepped away
  screen_busy: boolean | null; // full-screen app, presentation or video keeping the screen on
};
type Kind = "usable_idle" | "in_use" | "asleep";

const MAX_BATCH = 1500;
const MAX_AGE_MS = 7 * 86400000;

function clean(r: Record<string, unknown>): Reading | null {
  const t = Date.parse(String(r.ts));
  if (Number.isNaN(t) || t < Date.now() - MAX_AGE_MS || t > Date.now() + 5 * 60000) return null;
  const n = (v: unknown, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : null;
  return {
    ts: new Date(t).toISOString(),
    plugged_in: typeof r.plugged_in === "boolean" ? r.plugged_in : null,
    battery_pct: n(r.battery_pct, 100),
    input_idle_sec: n(r.input_idle_sec, 10 ** 8),
    cpu_pct: n(r.cpu_pct, 100),
    ram_pct: n(r.ram_pct, 100),
    locked: typeof r.locked === "boolean" ? r.locked : null,
    screen_busy: typeof r.screen_busy === "boolean" ? r.screen_busy : null,
  };
}

function untouched(sec: number) {
  return sec < 60 ? `${sec} s` : `${Math.round(sec / 60)} min`;
}

function judge(r: Reading, idleSec: number, cpuMax: number) {
  const why: string[] = [];
  if (r.plugged_in !== true) why.push(r.plugged_in === false ? "on battery" : "power state unknown");
  if (r.screen_busy) why.push("full-screen app or video playing");
  // A locked screen means the person has left, even if they touched it moments ago.
  if (r.locked) {
    // counts as untouched
  } else if (r.input_idle_sec === null) why.push("idle time unknown");
  else if (r.input_idle_sec < idleSec) why.push(`in use (needs ${untouched(idleSec)} untouched)`);
  if (r.cpu_pct === null) why.push("CPU use unknown");
  else if (r.cpu_pct >= cpuMax) why.push(`CPU ${Math.round(r.cpu_pct)}% (needs under ${cpuMax}%)`);
  return why;
}

export async function POST(request: Request) {
  const deviceId = readDeviceToken(request.headers.get("authorization"));
  if (!deviceId) return Response.json({ error: "Invalid device token." }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: device }, { data: settings }] = await Promise.all([
    admin.from("devices").select("id, status, cores").eq("id", deviceId).single(),
    admin.from("device_settings").select("*").eq("device_id", deviceId).maybeSingle(),
  ]);
  // Deleted from the dashboard: tell the agent to stop and forget its token.
  if (!device) return Response.json({ error: "This device was removed from the dashboard.", removed: true }, { status: 410 });

  // Seconds if set (migration 0005), otherwise the older whole-minute setting.
  const idleSec = settings?.idle_threshold_sec ?? (settings?.idle_threshold_min ?? 5) * 60;
  const idleMin = Math.max(1, Math.round(idleSec / 60));
  const cpuMax = settings?.cpu_threshold_pct ?? 20;
  const reply = { paused: device.status === "offline", settings: { idle_threshold_min: idleMin, idle_threshold_sec: idleSec, cpu_threshold_pct: cpuMax } };

  const body = await request.json().catch(() => null);
  const interval = Math.min(Math.max(Number(body?.interval_sec) || 60, 10), 600);

  const { data: open } = await admin
    .from("sessions")
    .select("id, type")
    .eq("device_id", deviceId)
    .is("end_ts", null)
    .order("start_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Agent shutting down (or computer going to sleep): close the timeline.
  if (body?.event === "stop") {
    if (open) await admin.from("sessions").update({ end_ts: new Date().toISOString() }).eq("id", open.id);
    if (!reply.paused) await admin.from("devices").update({ status: "asleep" }).eq("id", deviceId);
    return Response.json(reply);
  }
  // Paused on the dashboard: drop readings, keep the agent waiting.
  if (reply.paused) return Response.json(reply);

  const readings = (Array.isArray(body?.readings) ? body.readings.slice(-MAX_BATCH) : [])
    .map(clean)
    .filter((r: Reading | null): r is Reading => r !== null)
    .sort((a: Reading, b: Reading) => a.ts.localeCompare(b.ts));
  if (!readings.length) return Response.json({ error: "No valid readings." }, { status: 400 });

  const { data: last } = await admin
    .from("telemetry")
    .select("ts")
    .eq("device_id", deviceId)
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  let prevMs = last ? Date.parse(last.ts) : null;
  let openSession: { id?: number; type: Kind; start: string } | null = open ? { id: open.id, type: open.type, start: "" } : null;
  const closes: { id?: number; type: Kind; start: string; end: string }[] = [];
  const perDay = new Map<string, { idle: number; up: number }>();
  const telemetry = [];
  let lastWhy: string[] = [];

  for (const r of readings) {
    const t = Date.parse(r.ts);
    if (prevMs !== null && t <= prevMs) continue; // already recorded
    const why = judge(r, idleSec, cpuMax);
    const kind: Kind = why.length ? "in_use" : "usable_idle";
    const gap = prevMs === null ? interval * 1000 : t - prevMs;

    // A gap much longer than the interval means the computer was asleep or off.
    if (prevMs !== null && gap > 3 * interval * 1000) {
      const prevIso = new Date(prevMs).toISOString();
      if (openSession) closes.push({ ...openSession, end: prevIso });
      closes.push({ type: "asleep", start: prevIso, end: r.ts });
      openSession = null;
    }
    if (openSession?.type !== kind) {
      if (openSession) closes.push({ ...openSession, end: r.ts });
      openSession = { type: kind, start: r.ts };
    }

    const credit = Math.min(gap, 2 * interval * 1000) / 3600000;
    const day = sgDate(t); // Singapore calendar day
    const sum = perDay.get(day) ?? { idle: 0, up: 0 };
    sum.up += credit;
    if (kind === "usable_idle") sum.idle += credit;
    perDay.set(day, sum);

    telemetry.push({
      device_id: deviceId,
      ts: r.ts,
      awake: true,
      plugged_in: r.plugged_in,
      input_idle_sec: r.input_idle_sec === null ? null : Math.round(r.input_idle_sec),
      cpu_pct: r.cpu_pct,
      ram_pct: r.ram_pct,
      usable_idle: kind === "usable_idle",
    });
    prevMs = t;
    lastWhy = why;
  }
  if (!telemetry.length) return Response.json({ ...reply, usable_idle: null, why_not: [] });

  await admin.from("telemetry").insert(telemetry);

  // Sessions: close finished ones, insert new ones, leave the current one open.
  for (const s of closes) {
    if (s.id) await admin.from("sessions").update({ end_ts: s.end }).eq("id", s.id);
    else await admin.from("sessions").insert({ device_id: deviceId, start_ts: s.start, end_ts: s.end, type: s.type });
  }
  if (openSession && !openSession.id) {
    await admin.from("sessions").insert({ device_id: deviceId, start_ts: openSession.start, end_ts: null, type: openSession.type });
  }

  const cores = device.cores ?? 1;
  for (const [date, add] of perDay) {
    const { data: row } = await admin
      .from("daily_summary")
      .select("*")
      .eq("device_id", deviceId)
      .eq("date", date)
      .maybeSingle();
    const idle = Number(row?.usable_idle_hours ?? 0) + add.idle;
    await admin.from("daily_summary").upsert({
      device_id: deviceId,
      date,
      usable_idle_hours: Math.round(idle * 1e4) / 1e4,
      core_hours: Math.round(idle * cores * 1e3) / 1e3,
      uptime_hours: Math.round((Number(row?.uptime_hours ?? 0) + add.up) * 1e4) / 1e4,
    });
  }

  const usable = lastWhy.length === 0;
  await admin.from("devices").update({ status: usable ? "idle" : "in_use" }).eq("id", deviceId);

  return Response.json({ ...reply, recorded: telemetry.length, usable_idle: usable, why_not: lastWhy });
}
