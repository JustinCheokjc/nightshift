import Link from "next/link";
import { sumBy } from "@/lib/strip";
import { sgDate, sgDateDaysAgo } from "@/lib/time";
import { buildHeatmap } from "@/lib/heatmap";
import { EARNING_RATE_PER_CORE_HOUR, IDLE_POWER_DRAW_KW, EXPLAIN } from "@/lib/estimates";
import type { DevicesData } from "@/lib/devicesData";
import { toggleDevicePause, updateIdleThreshold } from "@/app/actions/controls";
import Kpi from "@/components/Kpi";
import Icon from "@/components/Icon";
import DeviceInsights from "@/components/ai/DeviceInsights";
import { statusOf, specsOf, timeAgo, lastSeenByDevice } from "@/components/views/DevicesView";

const THRESHOLDS = [30, 60, 120, 300, 600, 900, 1800];
const fmtH = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);

/** One device: status, 7-day hour-by-hour heatmap, hardware, settings and daily history. */
export default function DeviceDetailView({ data, demo = false, basePath }: { data: DevicesData; demo?: boolean; basePath: string }) {
  const device = data.devices[0];
  const { now } = data;
  const st = statusOf(device);
  const paused = device.status === "offline";
  const weekStart = sgDateDaysAgo(now, 6);
  const rows = data.summaries.filter((s) => s.device_id === device.id);
  const week = rows.filter((s) => s.date >= weekStart);
  const idleWeek = sumBy(week, (s) => s.usable_idle_hours);
  const coreWeek = sumBy(week, (s) => s.core_hours);
  const earnWeek = coreWeek * EARNING_RATE_PER_CORE_HOUR;
  const powerWeek = idleWeek * IDLE_POWER_DRAW_KW * data.electricityRate;
  const heat = buildHeatmap(data.sessions.filter((s) => s.device_id === device.id), now);
  const settings = data.settings.find((s) => s.device_id === device.id);
  const threshold = settings?.idle_threshold_sec ?? (settings?.idle_threshold_min ?? 5) * 60;
  const seen = lastSeenByDevice(data).get(device.id);
  const history = [...rows].reverse().slice(0, 14);
  const today = sgDate(now);

  const hardware: [string, string][] = [
    ["Operating system", device.os],
    ["Processor", device.cpu_model ?? "Unknown"],
    ["CPU cores", device.cores ? String(device.cores) : "Unknown"],
    ["Memory", device.ram_gb ? `${Number(device.ram_gb)} GB` : "Unknown"],
    ["Graphics", device.gpu_model ?? "Not reported"],
    ["Agent version", device.agent_version ?? "Unknown"],
    ["Added", new Date(device.enrolled_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" })],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={basePath} className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--mut)] hover:text-[var(--ink)]">
          <Icon name="chevron" size={14} className="rotate-180" /> All devices
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surf)] text-[var(--mut)]">
              <Icon name="devices" size={22} />
            </span>
            <div>
              <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
                {device.name} <span className={`badge ${st.tone}`}>{st.label}</span>
              </h1>
              <p className="mt-1 text-sm text-[var(--mut)]">{specsOf(device)} · last seen {timeAgo(seen, now).toLowerCase()}</p>
            </div>
          </div>
          {demo ? (
            <button type="button" className="btn" disabled title="Sign in to change this">{paused ? "Resume" : "Pause"} reporting</button>
          ) : (
            <form action={toggleDevicePause.bind(null, device.id, !paused)}>
              <button type="submit" className="btn">{paused ? "Resume" : "Pause"} reporting</button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon="clock" value={idleWeek} decimals={1} suffix=" h" label="Usable idle, 7 days" info={EXPLAIN.usableIdle}
          hint={`${fmtH(idleWeek / 7)} a day on average`} />
        <Kpi icon="cpu" value={coreWeek} suffix=" core-h" label="Capacity, 7 days" info={EXPLAIN.capacity}
          hint={`${device.cores ?? "?"} cores`} />
        <Kpi icon="coin" value={earnWeek} decimals={earnWeek < 10 ? 3 : 2} prefix="S$" label="Est. earnings, 7 days" info={EXPLAIN.earnings}
          hint={`About S$${((earnWeek / 7) * 30).toFixed(2)} a month`} />
        <Kpi icon="bolt" value={powerWeek} decimals={3} prefix="S$" label="Est. electricity, 7 days" info={EXPLAIN.electricity}
          hint={`At S$${data.electricityRate} per kWh`} />
      </div>

      <DeviceInsights deviceId={device.id} demo={demo} />

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">When this device is idle</h2>
            <p className="card-sub">Each square is one hour, Singapore time. Darker means more of that hour was usable idle.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--mut)]">
            Less
            {[0.15, 0.4, 0.7, 1].map((o) => <span key={o} className="h-3 w-3 rounded-[3px] bg-[var(--idle)]" style={{ opacity: o }} />)}
            More
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[64px_repeat(24,minmax(0,1fr))] gap-[3px]">
              <span />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="text-center text-[10px] text-[var(--mut)]">{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>
              ))}
              {heat.map((day) => (
                <div key={day.date} className="contents">
                  <span className={`self-center text-xs ${day.date === today ? "font-semibold" : "text-[var(--mut)]"}`}>{day.date === today ? "Today" : day.label}</span>
                  {day.hours.map((c, h) => {
                    const tip = `${day.label} ${String(h).padStart(2, "0")}:00 · ${Math.round(c.idle * 60)} min idle, ${Math.round(c.use * 60)} min in use`;
                    return (
                      <span key={h} title={tip} aria-label={tip}
                        className="aspect-square rounded-[3px]"
                        style={{ background: c.idle > 0.02 ? "var(--idle)" : c.use > 0.02 ? "var(--use)" : "var(--sleep)",
                          opacity: c.idle > 0.02 ? 0.15 + 0.85 * Math.min(1, c.idle) : c.use > 0.02 ? 0.45 : 1 }} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--mut)]">Grey squares were in use; the faintest squares were asleep, off or not yet recorded.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="card-title mb-3">Hardware</h2>
          <dl className="grid grid-cols-[minmax(0,140px)_1fr] gap-x-4 gap-y-2.5 text-[13px]">
            {hardware.map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-[var(--mut)]">{k}</dt><dd className="truncate" title={v}>{v}</dd></div>
            ))}
          </dl>
        </section>
        <section className="card">
          <h2 className="card-title">Idle detection</h2>
          <p className="card-sub mb-4">How long this device must be untouched before its time counts as idle.</p>
          <form action={demo ? undefined : updateIdleThreshold.bind(null, device.id)} className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="idle" className="label">Counts as idle after</label>
              <select id="idle" name="seconds" defaultValue={String(threshold)} disabled={demo} className="input">
                {THRESHOLDS.map((t) => (
                  <option key={t} value={t}>{t < 60 ? `${t} seconds untouched` : `${t / 60} minute${t === 60 ? "" : "s"} untouched`}</option>
                ))}
              </select>
            </div>
            <button type={demo ? "button" : "submit"} disabled={demo} title={demo ? "Sign in to change this" : undefined} className="btn">Save</button>
          </form>
          <p className="mt-4 text-xs text-[var(--mut)]">
            The device must also be plugged in and under 20% CPU. Locked screens count as away straight away.
          </p>
        </section>
      </div>

      <section className="card">
        <h2 className="card-title mb-3">Daily history</h2>
        {!history.length ? (
          <p className="py-6 text-center text-sm text-[var(--mut)]">No days recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm whitespace-nowrap">
              <thead><tr><th>Date</th><th className="text-right">Usable idle</th><th className="text-right">Awake</th><th className="text-right">Core-hours</th><th className="text-right">Est. value</th><th className="w-1/3"><span className="sr-only">Share idle</span></th></tr></thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date === today ? "Today" : new Date(`${r.date}T00:00:00Z`).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</td>
                    <td className="text-right tabular-nums">{fmtH(r.usable_idle_hours)}</td>
                    <td className="text-right tabular-nums text-[var(--mut)]">{fmtH(r.uptime_hours)}</td>
                    <td className="text-right tabular-nums">{r.core_hours.toFixed(1)}</td>
                    <td className="text-right tabular-nums">S${(r.core_hours * EARNING_RATE_PER_CORE_HOUR).toFixed(3)}</td>
                    <td>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--sleep)]">
                        <div className="h-full rounded-full bg-[var(--idle)]" style={{ width: `${Math.min(100, (r.usable_idle_hours / 24) * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
