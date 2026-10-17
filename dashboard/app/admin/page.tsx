import Link from "next/link";
import { loadFleet, type HourStat } from "@/lib/fleet";
import { sgHour } from "@/lib/time";
import { EXPLAIN } from "@/lib/estimates";
import Kpi from "@/components/Kpi";
import Reveal from "@/components/Reveal";
import HardwareMixChart from "@/components/HardwareMixChart";
import EconomicsPanel from "@/components/EconomicsPanel";
import PageHeader from "@/components/PageHeader";
import FleetBriefing from "@/components/ai/FleetBriefing";
import { statusOf, timeAgo } from "@/components/views/DevicesView";

const QUIET_MS = 24 * 3600 * 1000;

/** Hour-of-day bars: average devices usable idle (teal) and in use (grey). Pure CSS, so it follows the theme. */
function HourChart({ hours, nowHour }: { hours: HourStat[]; nowHour: number }) {
  const max = Math.max(1, ...hours.map((h) => h.usable + h.inUse));
  return (
    <div>
      <div className="flex h-48 items-end gap-[3px]">
        {hours.map((h) => (
          <div key={h.hour} className="group relative flex h-full flex-1 flex-col justify-end"
            title={`${String(h.hour).padStart(2, "0")}:00 · ${h.usable.toFixed(1)} devices idle, ${h.inUse.toFixed(1)} in use · ${h.coreHours.toFixed(1)} core-h`}>
            <div className="rounded-t-[3px] bg-[var(--use)]" style={{ height: `${(h.inUse / max) * 100}%` }} />
            <div className={`bg-[var(--idle)] ${h.inUse ? "" : "rounded-t-[3px]"}`} style={{ height: `${(h.usable / max) * 100}%` }} />
            {h.hour === nowHour && <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--ink)]" />}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[var(--mut)]">
        {[0, 6, 12, 18, 23].map((h) => <span key={h}>{String(h).padStart(2, "0")}:00</span>)}
      </div>
    </div>
  );
}

export default async function OperatorPage() {
  const fleet = await loadFleet();
  const { devices, hours, now } = fleet;
  const reporting = devices.filter((d) => ["idle", "in_use", "online"].includes(d.status)).length;
  const usableNow = devices.filter((d) => d.status === "idle").length;
  const core7d = devices.reduce((a, d) => a + d.core7d, 0);
  const idle7d = devices.reduce((a, d) => a + d.idle7d, 0);
  const forecastCoreHours = hours.reduce((a, h) => a + h.coreHours, 0); // a typical day
  const peak = [...hours].sort((a, b) => b.usable - a.usable)[0];
  const quiet = devices.filter((d) => d.status !== "offline" && (!d.lastSeen || now - d.lastSeen > QUIET_MS));
  const flagged = devices.filter((d) => d.openFlags > 0);

  const mix = new Map<string, number>();
  for (const d of devices) {
    const key = !d.cores ? "Unknown" : d.cores <= 4 ? "Up to 4 cores" : d.cores <= 8 ? "5–8 cores" : d.cores <= 12 ? "9–12 cores" : "13+ cores";
    mix.set(key, (mix.get(key) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fleet" description="Answers one question: how many usable core-hours can we promise a buyer?"
        actions={<a href="/admin/export" className="btn">Export flags CSV</a>} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon="devices" value={devices.length} label="Devices enrolled" hint={`${fleet.contributors} contributor${fleet.contributors === 1 ? "" : "s"}`} />
        <Kpi icon="clock" value={reporting} label="Reporting now" hint={`${usableNow} usable idle right now`} />
        <Kpi icon="cpu" value={core7d} decimals={1} suffix=" core-h" label="Capacity, last 7 days" info={EXPLAIN.capacity}
          hint={`${idle7d.toFixed(1)} usable idle hours`} />
        <Kpi icon="bolt" value={forecastCoreHours} decimals={1} suffix=" core-h" label="Typical day forecast"
          info="Average usable core-hours per day, from the last 7 days of agent sessions. The number to quote a buyer."
          hint={peak && peak.usable > 0 ? `Peak at ${String(peak.hour).padStart(2, "0")}:00 (${peak.usable.toFixed(1)} devices)` : "No sessions yet"} />
      </div>

      <FleetBriefing />

      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="card lg:col-span-2">
          <div className="card-head">
            <div>
              <h2 className="card-title">When the fleet is available</h2>
              <p className="card-sub">Average devices per hour of day, Singapore time, over the last 7 days.</p>
            </div>
            <div className="flex gap-4 text-xs text-[var(--mut)]">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[var(--idle)]" />Usable idle</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[var(--use)]" />In use</span>
            </div>
          </div>
          {devices.length ? <HourChart hours={hours} nowHour={sgHour(now)} /> : <p className="py-10 text-center text-sm text-[var(--mut)]">No devices enrolled yet.</p>}
        </Reveal>
        <Reveal delay={0.06} className="card">
          <h2 className="card-title mb-3">Hardware mix</h2>
          {mix.size ? <HardwareMixChart data={[...mix.entries()].map(([name, value]) => ({ name, value }))} />
            : <p className="text-sm text-[var(--mut)]">No devices enrolled yet.</p>}
        </Reveal>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EconomicsPanel coreHoursPerDay={core7d / 7} idleHoursPerDay={idle7d / 7} devicesEnrolled={devices.length} />
        <Reveal className="card">
          <h2 className="card-title mb-3">Needs attention</h2>
          {!quiet.length && !flagged.length ? (
            <p className="text-sm text-[var(--mut)]">Nothing right now. Every active device has reported in the last day and passed its safety checks.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--line)]">
              {quiet.map((d) => (
                <li key={`q-${d.id}`} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <span className="min-w-0"><b className="font-medium">{d.name}</b><span className="block truncate text-xs text-[var(--mut)]">{d.owner}</span></span>
                  <span className="badge warn shrink-0">{d.lastSeen ? `Quiet ${timeAgo(d.lastSeen, now).replace(" ago", "")}` : "Never reported"}</span>
                </li>
              ))}
              {flagged.map((d) => (
                <li key={`f-${d.id}`} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <span className="min-w-0"><b className="font-medium">{d.name}</b><span className="block truncate text-xs text-[var(--mut)]">{d.owner}</span></span>
                  <Link href="/admin/security" className="badge bad shrink-0">{d.openFlags} security issue{d.openFlags === 1 ? "" : "s"}</Link>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </div>

      <Reveal className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">All devices</h2>
            <p className="card-sub">Every enrolled device across contributors.</p>
          </div>
        </div>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="table table-sm min-w-[720px] whitespace-nowrap">
            <thead><tr><th>Device</th><th>Owner</th><th>Status</th><th className="text-right">Cores</th><th className="text-right">Idle, 7 days</th><th className="text-right">Core-hours</th><th>Last seen</th></tr></thead>
            <tbody>
              {devices.map((d) => {
                const st = statusOf(d);
                return (
                  <tr key={d.id}>
                    <td><span className="font-medium">{d.name}</span><span className="block text-xs text-[var(--mut)]">{d.os}</span></td>
                    <td className="text-[var(--mut)]">{d.owner}</td>
                    <td><span className={`badge ${st.tone}`}>{st.label}</span></td>
                    <td className="text-right tabular-nums">{d.cores ?? "—"}</td>
                    <td className="text-right tabular-nums">{d.idle7d.toFixed(1)} h</td>
                    <td className="text-right tabular-nums">{d.core7d.toFixed(1)}</td>
                    <td className="text-[var(--mut)]">{d.lastSeen ? timeAgo(d.lastSeen, now) : "Never"}</td>
                  </tr>
                );
              })}
              {!devices.length && <tr><td colSpan={7} className="py-8 text-center text-[var(--mut)]">No devices enrolled yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  );
}
