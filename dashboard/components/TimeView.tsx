"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Summary = { device_id: string; date: string; usable_idle_hours: number; core_hours: number; uptime_hours: number };
type DeviceInfo = { id: string; name: string; enrolled_at: string };

// Per day: usable idle (from the agent), in use = on but not usable idle,
// asleep or off = the rest of the day. Days are UTC, matching the agent.
function splitDay(rows: Summary[], date: string, today: string, hoursSoFarToday: number) {
  const idle = rows.reduce((a, r) => a + Number(r.usable_idle_hours), 0);
  const up = rows.reduce((a, r) => a + Number(r.uptime_hours), 0);
  const length = (date === today ? hoursSoFarToday : 24) * Math.max(rows.length, 1);
  return { idle, inUse: Math.max(0, up - idle), off: Math.max(0, length - up), coreHours: rows.reduce((a, r) => a + Number(r.core_hours), 0) };
}

function fmtHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
}

function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return { idle: get("--idle", "#1f8a7d"), use: get("--use", "#b9c7ce"), sleep: get("--sleep", "#e3eaed"),
    mut: get("--mut", "#5b7480"), line: get("--line", "#d5dfe3") };
}

export default function TimeView({ devices, summaries, today, hoursSoFarToday, ratePerCoreHour }: {
  devices: DeviceInfo[]; summaries: Summary[]; today: string; hoursSoFarToday: number; ratePerCoreHour: number;
}) {
  const [device, setDevice] = useState("all");
  const [range, setRange] = useState(7);
  const rows = summaries.filter((s) => device === "all" || s.device_id === device);
  const byDate = new Map<string, Summary[]>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);

  // All-time totals since the first tracked day.
  const allDays = [...byDate.keys()].sort();
  const totals = allDays.reduce((t, d) => {
    const x = splitDay(byDate.get(d)!, d, today, hoursSoFarToday);
    return { idle: t.idle + x.idle, inUse: t.inUse + x.inUse, coreHours: t.coreHours + x.coreHours };
  }, { idle: 0, inUse: 0, coreHours: 0 });
  const chosen = devices.filter((d) => device === "all" || d.id === device);
  const joined = chosen.map((d) => d.enrolled_at).sort()[0];

  // Last N days, including days with no data.
  const days: { label: string; idle: number; inUse: number; off: number }[] = [];
  const end = new Date(`${today}T00:00:00Z`);
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10);
    const r = byDate.get(d);
    const label = new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, range > 7 ? { day: "numeric", month: "short" } : { weekday: "short", day: "numeric" });
    if (!r) { days.push({ label, idle: 0, inUse: 0, off: 0 }); continue; }
    const x = splitDay(r, d, today, hoursSoFarToday);
    days.push({ label, idle: +x.idle.toFixed(2), inUse: +x.inUse.toFixed(2), off: +x.off.toFixed(2) });
  }
  const tracked = days.filter((d) => d.idle + d.inUse > 0);
  const avgIdle = tracked.length ? tracked.reduce((a, d) => a + d.idle, 0) / tracked.length : 0;
  const avgUse = tracked.length ? tracked.reduce((a, d) => a + d.inUse, 0) / tracked.length : 0;
  const c = themeColors();

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Time</h3>
          <p className="text-xs text-[var(--mut)]">How your {device === "all" ? "devices" : "device"} spent each day, measured by the agent.</p>
        </div>
        <div className="flex gap-2">
          <select aria-label="Device" value={device} onChange={(e) => setDevice(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--surf)] px-2 py-1 text-xs">
            <option value="all">All devices</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select aria-label="Range" value={range} onChange={(e) => setRange(Number(e.target.value))}
            className="rounded-lg border border-[var(--line)] bg-[var(--surf)] px-2 py-1 text-xs">
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option>
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [fmtHours(totals.idle), "Idle time given, all time"],
          [fmtHours(totals.inUse), "Screen time (in use), all time"],
          [`S$${(totals.coreHours * ratePerCoreHour).toFixed(totals.coreHours * ratePerCoreHour < 1 ? 3 : 2)}`, "Est. value of idle time, all time"],
          [joined ? new Date(joined).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—", "Tracking since"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-lg bg-[var(--bg)] p-3">
            <b className="block font-mono text-lg tabular-nums">{v}</b>
            <span className="text-xs text-[var(--mut)]">{l}</span>
          </div>
        ))}
      </div>

      {tracked.length ? (
        <>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.mut }} tickLine={false} axisLine={{ stroke: c.line }} interval="preserveStartEnd" minTickGap={8} />
                <YAxis tick={{ fontSize: 11, fill: c.mut }} tickLine={false} axisLine={false} domain={[0, 24]} ticks={[0, 6, 12, 18, 24]} unit="h" />
                <Tooltip formatter={(v) => fmtHours(Number(v))}
                  contentStyle={{ background: "var(--surf)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="idle" name="Usable idle" stackId="d" fill={c.idle} isAnimationActive={false} />
                <Bar dataKey="inUse" name="In use (screen time)" stackId="d" fill={c.use} isAnimationActive={false} />
                <Bar dataKey="off" name="Asleep, off or not tracked" stackId="d" fill={c.sleep} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--mut)]">
            <span className="flex flex-wrap gap-3">
              <span><s className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: c.idle }} />Usable idle</span>
              <span><s className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: c.use }} />In use (screen time)</span>
              <span><s className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: c.sleep }} />Asleep, off or not tracked</span>
            </span>
            <span>Average per tracked day: {fmtHours(avgIdle)} idle, {fmtHours(avgUse)} in use</span>
          </div>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-[var(--mut)]">No tracked time in this range yet. Time appears here once a device&apos;s agent starts reporting.</p>
      )}
      <p className="mt-2 text-xs text-[var(--mut)]">Screen time is time the device was on but not idle: in use, on battery or busy. Only time while the agent was running is counted; days are in UTC.</p>
    </div>
  );
}
