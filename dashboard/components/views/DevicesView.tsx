import Link from "next/link";
import { buildDayStrip, sumBy } from "@/lib/strip";
import { sgDate, sgDateDaysAgo, sgHoursToday } from "@/lib/time";
import { EARNING_RATE_PER_CORE_HOUR, IDLE_POWER_DRAW_KW, EXPLAIN } from "@/lib/estimates";
import type { DevicesData, DeviceRow } from "@/lib/devicesData";
import { seedDemoData } from "@/app/actions/seed";
import { toggleDevicePause, updateIdleThreshold, updateElectricityRate } from "@/app/actions/controls";
import Kpi from "@/components/Kpi";
import Reveal from "@/components/Reveal";
import WeeklyTrendChart from "@/components/WeeklyTrendChart";
import TimeView from "@/components/TimeView";
import AddDevice from "@/components/AddDevice";
import PageHeader from "@/components/PageHeader";
import DangerZone from "@/components/DangerZone";
import Onboarding from "@/components/Onboarding";
import Icon from "@/components/Icon";

export const STATUS = {
  idle: { label: "Idle", tone: "ok live" },
  online: { label: "Online", tone: "ok live" },
  in_use: { label: "In use", tone: "warn" },
  asleep: { label: "Asleep", tone: "" },
  offline: { label: "Offline", tone: "" },
} as const;

export function statusOf(d: Pick<DeviceRow, "status">) {
  if (d.status === "offline") return { label: "Paused", tone: "" };
  return STATUS[d.status as keyof typeof STATUS] ?? STATUS.offline;
}

export function specsOf(d: DeviceRow) {
  return [d.os, d.cores && `${d.cores} cores`, d.ram_gb && `${Number(d.ram_gb)} GB RAM`].filter(Boolean).join(" · ");
}

export function timeAgo(t: number | undefined, now: number) {
  if (!t) return "No data yet";
  const min = Math.round((now - t) / 60000);
  if (min < 2) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export function lastSeenByDevice(data: DevicesData) {
  const seen = new Map<string, number>();
  for (const s of data.sessions) {
    if (s.type === "asleep") continue;
    const t = s.end_ts ? Date.parse(s.end_ts) : data.now;
    if (t > (seen.get(s.device_id) ?? 0)) seen.set(s.device_id, t);
  }
  return seen;
}

const moneyDecimals = (v: number) => (v === 0 ? 2 : v < 0.1 ? 4 : v < 10 ? 3 : 2);
const THRESHOLDS = [30, 60, 120, 300, 600, 900, 1800];

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Strip({ data, deviceId, name }: { data: DevicesData; deviceId: string; name: string }) {
  const strip = buildDayStrip(data.sessions.filter((s) => s.device_id === deviceId), data.now);
  return (
    <div>
      <div className="strip" role="img" aria-label={`Activity for ${name} over the last 24 hours`}>
        {strip.map((c, i) => <i key={i} className={c} />)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--mut)]">
        <span>24h ago</span><span>12h</span><span>Now</span>
      </div>
    </div>
  );
}

/** The Devices page, for a signed-in contributor ("live") or the public demo. */
export default function DevicesView({ data, demo = false, basePath }: { data: DevicesData; demo?: boolean; basePath: string }) {
  const { devices, now } = data;
  const today = sgDate(now);
  const weekStart = sgDateDaysAgo(now, 6);
  const week = data.summaries.filter((s) => s.date >= weekStart);
  const usableIdleToday = sumBy(week.filter((s) => s.date === today), (s) => s.usable_idle_hours);
  const coreHoursWeek = sumBy(week, (s) => s.core_hours);
  const usableIdleWeek = sumBy(week, (s) => s.usable_idle_hours);
  const estEarnings = coreHoursWeek * EARNING_RATE_PER_CORE_HOUR;
  const estElectricity = usableIdleWeek * IDLE_POWER_DRAW_KW * data.electricityRate;
  const idleInMinutes = usableIdleToday < 1;
  const activeNow = devices.filter((d) => ["idle", "in_use", "online"].includes(d.status)).length;
  const lastSeen = lastSeenByDevice(data);
  const settingsByDevice = new Map(data.settings.map((s) => [s.device_id, s]));

  const trendByDate = new Map<string, number>();
  for (const s of week) trendByDate.set(s.date, (trendByDate.get(s.date) ?? 0) + s.usable_idle_hours);
  const trendData = [...trendByDate.entries()].map(([date, hours]) => ({ date, hours }));

  const steps = {
    added: devices.length > 0,
    reporting: data.sessions.length > 0 || data.summaries.length > 0,
    fullDay: data.summaries.some((s) => s.date < today),
  };
  const readOnly = "Sign in to change this";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Devices"
        description="How much usable idle time your computers give, measured every minute by the Nightshift agent."
        actions={demo ? undefined : (
          <>
            <a href="/dashboard/export" className="btn"><Icon name="download" size={14} /> Export data</a>
            <a href="#add-device" className="btn btn-primary"><Icon name="plus" size={14} /> Add device</a>
          </>
        )}
      />

      {!demo && <Onboarding steps={steps} />}

      <section aria-label="Summary" className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon="clock" value={idleInMinutes ? usableIdleToday * 60 : usableIdleToday} decimals={1}
            suffix={idleInMinutes ? " min" : " h"} label="Usable idle today" info={EXPLAIN.usableIdle}
            hint={`${activeNow} of ${devices.length} device${devices.length === 1 ? "" : "s"} reporting now`} />
          <Kpi icon="cpu" value={coreHoursWeek} suffix=" core-h" label="Capacity this week" info={EXPLAIN.capacity}
            hint="Usable idle hours × CPU cores" />
          <Kpi icon="coin" value={estEarnings} decimals={moneyDecimals(estEarnings)} prefix="S$" label="Est. potential earnings"
            info={EXPLAIN.earnings} hint={`At S$${EARNING_RATE_PER_CORE_HOUR} per core-hour`} />
          <Kpi icon="bolt" value={estElectricity} decimals={moneyDecimals(estElectricity)} prefix="S$" label="Est. electricity cost"
            info={EXPLAIN.electricity} hint={`At S$${data.electricityRate} per kWh`} />
        </div>
        <p className="text-xs text-[var(--mut)]">
          Last 7 days, Singapore time. Capacity estimate only: real earnings depend on demand and are not guaranteed.
        </p>
      </section>

      {!devices.length ? (
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
              <form action={seedDemoData} className="mt-5"><button type="submit" className="btn">Load demo data</button></form>
            )}
          </Reveal>
          <AddDevice downloads={data.downloads} />
        </>
      ) : (
        <>
          <Reveal className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Your devices</h2>
                <p className="card-sub">The last 24 hours, in 30-minute blocks. Select a device for its full history.</p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-[var(--mut)]">
                <Legend color="var(--idle)" label="Usable idle" />
                <Legend color="var(--use)" label="In use" />
                <Legend color="var(--sleep)" label="Asleep or off" />
              </div>
            </div>

            {/* Phones: one card per device */}
            <ul className="flex flex-col divide-y divide-[var(--line)] md:hidden">
              {devices.map((device) => {
                const st = statusOf(device);
                return (
                  <li key={device.id} className="py-4 first:pt-0 last:pb-0">
                    <Link href={`${basePath}/devices/${device.id}`} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{device.name}</p>
                        <p className="truncate text-xs text-[var(--mut)]">{specsOf(device)}</p>
                      </div>
                      <span className={`badge ${st.tone}`}>{st.label}</span>
                    </Link>
                    <div className="mt-3"><Strip data={data} deviceId={device.id} name={device.name} /></div>
                    <p className="mt-2 text-xs text-[var(--mut)]">Last seen {timeAgo(lastSeen.get(device.id), now).toLowerCase()}</p>
                  </li>
                );
              })}
            </ul>

            {/* Tablet and desktop: table */}
            <div className="-mx-5 hidden overflow-x-auto px-5 md:block">
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
                    const paused = device.status === "offline";
                    const st = statusOf(device);
                    return (
                      <tr key={device.id} className="group">
                        <td>
                          <Link href={`${basePath}/devices/${device.id}`} className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--mut)] transition-colors group-hover:border-[var(--idle)] group-hover:text-[var(--idle)]">
                              <Icon name="devices" size={17} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium group-hover:underline">{device.name}</span>
                              <span className="block truncate text-xs text-[var(--mut)]" title={device.cpu_model ?? undefined}>{specsOf(device)}</span>
                            </span>
                          </Link>
                        </td>
                        <td><span className={`badge ${st.tone}`}>{st.label}</span></td>
                        <td><Strip data={data} deviceId={device.id} name={device.name} /></td>
                        <td className="whitespace-nowrap text-[var(--mut)]">{timeAgo(lastSeen.get(device.id), now)}</td>
                        <td className="text-right">
                          {demo ? (
                            <button type="button" className="btn btn-sm" disabled title={readOnly}>{paused ? "Resume" : "Pause"}</button>
                          ) : (
                            <form action={toggleDevicePause.bind(null, device.id, !paused)}>
                              <button type="submit" className="btn btn-sm">{paused ? "Resume" : "Pause"}</button>
                            </form>
                          )}
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
                <p className="flex h-[140px] items-center justify-center text-sm text-[var(--mut)]">The trend appears after two days of data.</p>
              )}
            </Reveal>
            {demo ? (
              <div className="card flex flex-col gap-4">
                <div>
                  <h2 className="card-title">Try it with your own laptop</h2>
                  <p className="card-sub">Your real idle hours replace this sample data within minutes.</p>
                </div>
                <ol className="flex flex-1 flex-col gap-3">
                  {["Sign in with your email, no password needed", "Download the agent for Windows, Mac or Linux", "Paste your setup key and leave it running"].map((t, i) => (
                    <li key={t} className="flex gap-3 text-[13px]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[11px] font-semibold text-[var(--mut)]">{i + 1}</span>
                      {t}
                    </li>
                  ))}
                </ol>
                <a href="/login" className="btn btn-primary self-start">Sign in to join the pilot</a>
              </div>
            ) : (
              <AddDevice downloads={data.downloads} compact />
            )}
          </div>

          <TimeView
            devices={devices.map((d) => ({ id: d.id, name: d.name, enrolled_at: d.enrolled_at }))}
            summaries={data.summaries}
            today={today}
            hoursSoFarToday={sgHoursToday(now)}
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
                {devices.map((device) => {
                  const s = settingsByDevice.get(device.id);
                  const select = (
                    <select id={`idle-${device.id}`} name="seconds" disabled={demo} className="input"
                      defaultValue={String(s?.idle_threshold_sec ?? (s?.idle_threshold_min ?? 5) * 60)}>
                      {THRESHOLDS.map((t) => (
                        <option key={t} value={t}>{t < 60 ? `${t} seconds untouched` : `${t / 60} minute${t === 60 ? "" : "s"} untouched`}</option>
                      ))}
                    </select>
                  );
                  return demo ? (
                    <div key={device.id} className="flex items-end gap-2">
                      <div className="flex-1"><label htmlFor={`idle-${device.id}`} className="label">{device.name}</label>{select}</div>
                      <button type="button" className="btn" disabled title={readOnly}>Save</button>
                    </div>
                  ) : (
                    <form key={device.id} action={updateIdleThreshold.bind(null, device.id)} className="flex items-end gap-2">
                      <div className="flex-1"><label htmlFor={`idle-${device.id}`} className="label">{device.name}</label>{select}</div>
                      <button type="submit" className="btn">Save</button>
                    </form>
                  );
                })}
              </div>
            </Reveal>
            <Reveal delay={0.06} className="card">
              <div className="card-head">
                <div>
                  <h2 className="card-title">Electricity rate</h2>
                  <p className="card-sub">Used to estimate what running your computer while idle costs you.</p>
                </div>
              </div>
              <form action={demo ? undefined : updateElectricityRate} className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="rate" className="label">Your rate (S$ per kWh)</label>
                  <input id="rate" name="rate" type="text" inputMode="decimal" defaultValue={data.electricityRate} disabled={demo} className="input" />
                </div>
                <button type={demo ? "button" : "submit"} disabled={demo} title={demo ? readOnly : undefined} className="btn">Save</button>
              </form>
              <p className="mt-3 text-xs text-[var(--mut)]">Check your latest electricity bill for your rate.</p>
            </Reveal>
          </div>

          {!demo && <DangerZone />}
        </>
      )}
    </div>
  );
}
