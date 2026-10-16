import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { buildDayStrip, sumBy } from "@/lib/strip";
import { seedDemoData } from "@/app/actions/seed";
import {
  toggleDevicePause,
  updateIdleThreshold,
  updateElectricityRate,
} from "@/app/actions/controls";
import Kpi from "@/components/Kpi";
import Reveal from "@/components/Reveal";
import WeeklyTrendChart from "@/components/WeeklyTrendChart";
import TimeView from "@/components/TimeView";
import RealtimeDevices from "@/components/RealtimeDevices";
import AddDevice, { type Download } from "@/components/AddDevice";
import PageHeader from "@/components/PageHeader";
import DangerZone from "@/components/DangerZone";
import Icon from "@/components/Icon";
import { existsSync } from "node:fs";
import path from "node:path";

// Contributor share of what buyers pay: about S$0.02 per core-hour (cloud spot CPU
// pricing) minus Nightshift's 30% cut, as modelled in sandbox/marketplace.py.
// Replace with measured prices once real buyers are paying.
const EARNING_RATE_PER_CORE_HOUR = 0.014;
const IDLE_POWER_DRAW_KW = 0.015; // extra draw of a laptop running jobs while idle
// Agent builds live in public/downloads (built by .github/workflows/build-agent.yml).
const AGENT_DOWNLOADS: Download[] = [
  { label: "Windows", href: "/downloads/nightshift-agent-windows.exe", note: "Windows 10 or 11" },
  { label: "Mac", href: "/downloads/nightshift-agent-macos.zip", note: "Apple silicon Macs. Intel Macs: use the Python script" },
  { label: "Linux", href: "/downloads/nightshift-agent-linux", note: "x86-64 desktop Linux" },
  { label: "Python script (any OS)", href: "/downloads/nightshift_agent.py", note: "Needs Python 3.9+" },
];
function availableDownloads() {
  return AGENT_DOWNLOADS.filter((d) =>
    existsSync(path.join(process.cwd(), "public", d.href))
  );
}

export default async function DashboardPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: devices } = await supabase
    .from("devices")
    .select("*")
    .eq("user_id", profile!.id)
    .order("enrolled_at");

  const deviceIds = (devices ?? []).map((d) => d.id);
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [{ data: settings }, { data: summaries }, { data: sessions }, { data: allSummaries }] =
    deviceIds.length
      ? await Promise.all([
          supabase
            .from("device_settings")
            .select("*")
            .in("device_id", deviceIds),
          supabase
            .from("daily_summary")
            .select("*")
            .in("device_id", deviceIds)
            .gte("date", weekAgo),
          supabase
            .from("sessions")
            .select("*")
            .in("device_id", deviceIds)
            // end_ts (not start_ts) so sessions that started before the
            // 24h window but are still ongoing within it are included.
            .or(`end_ts.gte.${dayAgo},end_ts.is.null`),
          supabase
            .from("daily_summary")
            .select("device_id, date, usable_idle_hours, core_hours, uptime_hours")
            .in("device_id", deviceIds)
            .order("date"),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const settingsByDevice = new Map(
    (settings ?? []).map((s) => [s.device_id, s])
  );
  const todaySummaries = (summaries ?? []).filter((s) => s.date === today);
  const usableIdleToday = sumBy(todaySummaries, (s) => s.usable_idle_hours);
  const coreHoursWeek = sumBy(summaries ?? [], (s) => s.core_hours);
  const usableIdleWeek = sumBy(summaries ?? [], (s) => s.usable_idle_hours);
  const estEarnings = coreHoursWeek * EARNING_RATE_PER_CORE_HOUR;
  const estElectricity =
    usableIdleWeek * IDLE_POWER_DRAW_KW * (profile?.electricity_rate ?? 0.31);
  // Show small amounts with enough precision that the first minutes are visible.
  const moneyDecimals = (v: number) => (v < 0.1 ? 4 : v < 10 ? 3 : 2);
  const idleInMinutes = usableIdleToday < 1;

  const trendByDate = new Map<string, number>();
  for (const s of summaries ?? []) {
    trendByDate.set(s.date, (trendByDate.get(s.date) ?? 0) + s.usable_idle_hours);
  }
  const trendData = [...trendByDate.entries()].map(([date, hours]) => ({
    date,
    hours,
  }));

  const electricityRate = profile?.electricity_rate ?? 0.31;
  const downloads = availableDownloads();
  const activeNow = (devices ?? []).filter((d) => d.status === "idle" || d.status === "in_use" || d.status === "online").length;

  // Most recent session edge per device: ongoing sessions mean "now".
  const nowMs = new Date(dayAgo).getTime() + 24 * 3600 * 1000;
  const lastSeen = new Map<string, number>();
  for (const s of sessions ?? []) {
    const t = s.end_ts ? new Date(s.end_ts).getTime() : nowMs;
    if (t > (lastSeen.get(s.device_id) ?? 0)) lastSeen.set(s.device_id, t);
  }

  return (
    <div className="flex flex-col gap-6">
      <RealtimeDevices userId={profile!.id} />
      <PageHeader
        title="Devices"
        description="How much usable idle time your computers give, measured every minute by the Nightshift agent."
        actions={
          <>
            <a href="/dashboard/export" className="btn">
              <Icon name="download" size={14} /> Export data
            </a>
            <a href="#add-device" className="btn btn-primary">
              <Icon name="plus" size={14} /> Add device
            </a>
          </>
        }
      />

      <section aria-label="Summary" className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            icon="clock"
            value={idleInMinutes ? usableIdleToday * 60 : usableIdleToday}
            decimals={1}
            suffix={idleInMinutes ? " min" : " h"}
            label="Usable idle today"
            hint={`${activeNow} of ${devices?.length ?? 0} device${devices?.length === 1 ? "" : "s"} reporting now`}
          />
          <Kpi icon="cpu" value={coreHoursWeek} suffix=" core-h" label="Capacity this week" hint="Usable idle hours × CPU cores" />
          <Kpi icon="coin" value={estEarnings} decimals={moneyDecimals(estEarnings)} prefix="S$" label="Est. potential earnings"
            hint={`At S$${EARNING_RATE_PER_CORE_HOUR} per core-hour`} />
          <Kpi icon="bolt" value={estElectricity} decimals={moneyDecimals(estElectricity)} prefix="S$" label="Est. electricity cost"
            hint={`At S$${electricityRate} per kWh`} />
        </div>
        <p className="text-xs text-[var(--mut)]">
          Last 7 days. Capacity estimate only: real earnings depend on demand and are not guaranteed.
        </p>
      </section>

      {!devices?.length ? (
        <>
          <Reveal className="card flex flex-col items-center py-12 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--mut)]">
              <Icon name="devices" size={22} />
            </span>
            <h2 className="text-base font-semibold">No devices yet</h2>
            <p className="mt-1 max-w-sm text-sm text-[var(--mut)]">
              Add your first computer below. Its idle time will appear here within a few minutes.
            </p>
            {process.env.NODE_ENV !== "production" && (
              <form action={seedDemoData} className="mt-5">
                <button type="submit" className="btn">Load demo data</button>
              </form>
            )}
          </Reveal>
          <AddDevice downloads={downloads} />
        </>
      ) : (
        <>
          <Reveal className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Your devices</h2>
                <p className="card-sub">The last 24 hours, in 30-minute blocks.</p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-[var(--mut)]">
                <Legend color="var(--idle)" label="Usable idle" />
                <Legend color="var(--use)" label="In use" />
                <Legend color="var(--sleep)" label="Asleep or off" />
              </div>
            </div>
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Status</th>
                    <th className="w-[42%]">Last 24 hours</th>
                    <th>Last seen</th>
                    <th className="text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => {
                    const deviceSessions = (sessions ?? []).filter((s) => s.device_id === device.id);
                    const strip = buildDayStrip(deviceSessions);
                    const paused = device.status === "offline";
                    const status = STATUS[device.status as keyof typeof STATUS] ?? STATUS.offline;
                    const specs = [
                      device.os,
                      device.cores && `${device.cores} cores`,
                      device.ram_gb && `${Number(device.ram_gb)} GB RAM`,
                    ].filter(Boolean).join(" · ");
                    return (
                      <tr key={device.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--mut)]">
                              <Icon name="devices" size={17} />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{device.name}</p>
                              <p className="truncate text-xs text-[var(--mut)]" title={device.cpu_model ?? undefined}>{specs}</p>
                            </div>
                          </div>
                        </td>
                        <td><span className={`badge ${status.tone}`}>{paused ? "Paused" : status.label}</span></td>
                        <td>
                          <div className="strip" role="img" aria-label={`Activity for ${device.name} over the last 24 hours`}>
                            {strip.map((c, i) => <i key={i} className={c} />)}
                          </div>
                          <div className="mt-1 flex justify-between text-[10px] text-[var(--mut)]">
                            <span>24h ago</span><span>12h</span><span>Now</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-[var(--mut)]">{timeAgo(lastSeen.get(device.id), nowMs)}</td>
                        <td className="text-right">
                          <form action={toggleDevicePause.bind(null, device.id, !paused)}>
                            <button type="submit" className="btn btn-sm">{paused ? "Resume" : "Pause"}</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Reveal>

          <div className="grid gap-4 lg:grid-cols-3">
            <Reveal className="card flex flex-col lg:col-span-2">
              <div className="card-head">
                <div>
                  <h2 className="card-title">Usable idle hours</h2>
                  <p className="card-sub">All devices, last 7 days.</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{usableIdleWeek.toFixed(1)} h</span>
              </div>
              {trendData.length > 1 ? (
                <WeeklyTrendChart data={trendData} className="h-[220px] min-h-[220px] flex-1" />
              ) : (
                <p className="flex h-[140px] items-center justify-center text-sm text-[var(--mut)]">
                  The trend appears after two days of data.
                </p>
              )}
            </Reveal>
            <AddDevice downloads={downloads} compact />
          </div>

          <TimeView
            devices={devices.map((d) => ({ id: d.id, name: d.name, enrolled_at: d.enrolled_at }))}
            summaries={allSummaries ?? []}
            today={today}
            hoursSoFarToday={new Date(dayAgo).getUTCHours() + new Date(dayAgo).getUTCMinutes() / 60}
            ratePerCoreHour={EARNING_RATE_PER_CORE_HOUR}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Reveal className="card">
              <div className="card-head">
                <div>
                  <h2 className="card-title">Idle detection</h2>
                  <p className="card-sub">How long a device must be untouched before its time counts as idle.</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {devices.map((device) => (
                  <form key={device.id} action={updateIdleThreshold.bind(null, device.id)} className="flex items-end gap-2">
                    <div className="flex-1">
                      <label htmlFor={`idle-${device.id}`} className="label">{device.name}</label>
                      <select
                        id={`idle-${device.id}`}
                        name="seconds"
                        defaultValue={String(
                          settingsByDevice.get(device.id)?.idle_threshold_sec ??
                            (settingsByDevice.get(device.id)?.idle_threshold_min ?? 5) * 60
                        )}
                        className="input"
                      >
                        {[30, 60, 120, 300, 600, 900, 1800].map((s) => (
                          <option key={s} value={s}>
                            {s < 60 ? `${s} seconds untouched` : `${s / 60} minute${s === 60 ? "" : "s"} untouched`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="btn">Save</button>
                  </form>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.06} className="card">
              <div className="card-head">
                <div>
                  <h2 className="card-title">Electricity rate</h2>
                  <p className="card-sub">Used to estimate what running your computer while idle costs you.</p>
                </div>
              </div>
              <form action={updateElectricityRate} className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="rate" className="label">Your rate (S$ per kWh)</label>
                  <input id="rate" name="rate" type="text" inputMode="decimal" defaultValue={electricityRate} className="input" />
                </div>
                <button type="submit" className="btn">Save</button>
              </form>
              <p className="mt-3 text-xs text-[var(--mut)]">Check your latest electricity bill for your rate.</p>
            </Reveal>
          </div>

          <DangerZone />
        </>
      )}
    </div>
  );
}

const STATUS = {
  idle: { label: "Idle", tone: "ok live" },
  online: { label: "Online", tone: "ok live" },
  in_use: { label: "In use", tone: "warn" },
  asleep: { label: "Asleep", tone: "" },
  offline: { label: "Offline", tone: "" },
} as const;

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function timeAgo(t: number | undefined, now: number) {
  if (!t) return "No data yet";
  const min = Math.round((now - t) / 60000);
  if (min < 2) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : "Over a day ago";
}
