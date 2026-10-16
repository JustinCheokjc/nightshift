"use client";

import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";
import {
  CLASSES, IMAGE, MAX_ITER, Market, SCENARIOS, type Config, type DeviceClass, type Kind, type LiveRow,
} from "@/lib/market/engine";
import PageHeader from "@/components/PageHeader";
import Icon from "@/components/Icon";

type Snap = ReturnType<typeof takeSnap>;
type Tab = "overview" | "settings" | "customers" | "contributors" | "trust" | "report";
const TABS: [Tab, string][] = [["overview", "Overview"], ["settings", "Market settings"], ["customers", "Customers"],
  ["contributors", "Contributors"], ["trust", "Trust & safety"], ["report", "Report"]];
const RUNS_KEY = "nightshift-market-runs";
// Simulated minutes per real second, with how long one simulated day takes.
const SPEEDS: [number, { short: string; title: string }][] = [
  [0.5, { short: "1×", title: "1 day in 48 min" }], [2, { short: "4×", title: "1 day in 12 min" }],
  [8, { short: "16×", title: "1 day in 3 min" }], [24, { short: "48×", title: "1 day in 1 min" }],
];
const BTN = "btn btn-sm";
const BTN_PRIMARY = "btn btn-primary";
const INPUT = "input mt-1.5";

const sgd = (v: number, d = 2) => `${Number(v.toFixed(d)) < 0 ? "−" : ""}S$${Math.abs(v).toFixed(d)}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const toneFor = (s: string) => (["idle", "working", "active", "delivered"].includes(s) ? "ok"
  : ["in_use", "late", "overdue"].includes(s) ? "warn" : ["suspended", "left"].includes(s) ? "bad" : "");
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");
function Status({ s }: { s: string }) {
  return <span className={`badge ${toneFor(s)}${s === "running" || s === "working" ? " live" : ""}`}>{titleCase(s)}</span>;
}

function takeSnap(m: Market) {
  return {
    clock: m.now, hour: Math.floor((((m.now % 1440) + 1440) % 1440) / 60), paused: m.paused, speed: m.simMinPerSec,
    scenario: m.scenario, cfg: JSON.parse(JSON.stringify(m.cfg)) as Config, kpi: m.kpis(), days: m.elapsedDays(),
    series: m.series.slice(-200), orders: m.recentOrders(12).map((o) => m.orderRow(o)), events: m.events.slice(-40).reverse(),
    buyers: [...m.buyers.values()].map((b) => ({ ...b })), devices: m.deviceRows(), classes: m.classEconomics(),
    trust: { ...m.trust, verify_cost: m.money.verify_cost },
  };
}

function clockLabel(min: number) {
  const m = Math.floor(((min % 1440) + 1440) % 1440);
  return `Day ${Math.floor(min / 1440) + 1}, ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function download(name: string, rows: Record<string, unknown>[]) {
  const head = rows.length ? Object.keys(rows[0]) : [];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [head.join(","), ...rows.map((r) => head.map((h) => cell(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ======================================================================
export default function MarketApp({ userId }: { userId: string }) {
  const market = useRef<Market | null>(null); // for effects
  const [m, setMarket] = useState<Market | null>(null); // for rendering
  const [snap, setSnap] = useState<Snap | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    // Created in the browser only: the model uses randomness, so it can't render on the server.
    const mk = new Market();
    market.current = mk;
    let last = performance.now(), n = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      mk.tick((now - last) / 1000);
      last = now;
      if (n++ % 4 === 0) { setMarket(mk); setSnap(takeSnap(mk)); }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // The viewer's enrolled devices join the market with their real idle status.
  useEffect(() => {
    const supabase = createClient();
    let stop = false;
    async function sync() {
      const { data } = await supabase.from("devices").select("id,name,cores,gpu_model,status,agent_version").eq("user_id", userId);
      if (!stop && data && market.current) market.current.setLive(data as LiveRow[]);
    }
    sync();
    const timer = setInterval(sync, 30000);
    return () => { stop = true; clearInterval(timer); };
  }, [userId]);

  const refresh = () => m && setSnap(takeSnap(m));
  if (!snap || !m) return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeader title="Market" description="How Nightshift sells idle capacity to customers, simulated hour by hour." />
      <div className="skeleton h-16" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-24" />)}</div>
    </div>
  );

  const night = snap.hour >= 22 || snap.hour < 7;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Market"
        description="How Nightshift sells idle capacity to customers, simulated hour by hour."
        actions={<span className="badge warn">Simulated · no real money</span>}
      />

      {/* Simulation control bar */}
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 py-3 print:hidden">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${night ? "bg-[color-mix(in_srgb,#6d7dff_16%,transparent)] text-[#8f9bff]" : "bg-[color-mix(in_srgb,var(--amber)_16%,transparent)] text-[var(--amber)]"}`}>
            <Icon name={night ? "moon" : "sun"} size={17} />
          </span>
          <div>
            <p className="text-[15px] font-semibold tabular-nums leading-tight">{clockLabel(snap.clock)}</p>
            <p className="text-xs text-[var(--mut)]">{night ? "Night: most laptops idle" : "Day: most laptops in use"}</p>
          </div>
        </div>
        <span className={`badge ${snap.paused ? "" : "ok live"}`}>{snap.paused ? "Paused" : "Running"}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Speed" className="flex rounded-lg border border-[var(--line)] bg-[var(--bg)] p-0.5">
            {SPEEDS.map(([v, l]) => (
              <button key={v} role="radio" aria-checked={snap.speed === v} title={l.title}
                onClick={() => { m.setSpeed(v); refresh(); }}
                className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${snap.speed === v ? "bg-[var(--surf)] text-[var(--ink)] shadow-sm" : "text-[var(--mut)] hover:text-[var(--ink)]"}`}>
                {l.short}
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => { m.setPaused(!m.paused); refresh(); }}>
            <Icon name={snap.paused ? "play" : "pause"} size={14} /> {snap.paused ? "Resume" : "Pause"}
          </button>
          <button className="btn" onClick={() => { m.reset(); refresh(); }}>
            <Icon name="reset" size={14} /> Reset
          </button>
        </div>
      </div>

      <div className="-mt-2 flex gap-1 overflow-x-auto border-b border-[var(--line)] print:hidden" role="tablist">
        {TABS.map(([id, name]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${tab === id ? "border-[var(--idle)] text-[var(--ink)]" : "border-transparent text-[var(--mut)] hover:text-[var(--ink)]"}`}>
            {name}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview s={snap} m={m} />}
      {tab === "settings" && <Settings s={snap} m={m} refresh={refresh} />}
      {tab === "customers" && <Customers s={snap} m={m} refresh={refresh} />}
      {tab === "contributors" && <Contributors s={snap} />}
      {tab === "trust" && <Trust s={snap} />}
      {tab === "report" && <Report s={snap} m={m} />}

    </div>
  );
}

// ---------------------------------------------------------------- shared
type KpiItem = { v: string; l: string; sub?: string; tone?: "good" | "warn" | "bad" };
function Kpis({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((k) => (
        <div key={k.l} className="card flex flex-col gap-2 p-4">
          <span className="text-xs font-medium text-[var(--mut)]">{k.l}</span>
          <b className={`text-[22px] font-semibold leading-none tracking-tight tabular-nums ${k.tone === "good" ? "text-[var(--idle)]" : k.tone === "warn" ? "text-[var(--amber)]" : k.tone === "bad" ? "text-[var(--bad)]" : ""}`}>{k.v}</b>
          {k.sub && <span className="text-xs text-[var(--mut)]">{k.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/** Small on/off switch (a styled checkbox, so it stays keyboard and screen-reader friendly). */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="relative inline-flex h-[18px] w-8 shrink-0">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 z-10 cursor-pointer opacity-0" />
      <span className="absolute inset-0 rounded-full bg-[var(--use)] transition-colors peer-checked:bg-[var(--idle)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--idle)]" />
      <span className="absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-3.5" />
    </span>
  );
}

/** Card with a title row (title, subtitle, optional right-hand content). */
function Panel({ title, sub, right, children, className = "" }: {
  title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <div><h2 className="card-title">{title}</h2>{sub && <p className="card-sub">{sub}</p>}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

const tooltipStyle = { background: "var(--surf)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 };

// SVG attributes can't read CSS variables, so charts use the theme's computed colours.
function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return { idle: get("--idle", "#1f8a7d"), use: get("--use", "#b9c7ce"), sleep: get("--sleep", "#e3eaed"),
    ink: get("--ink", "#14303a"), mut: get("--mut", "#5b7480"), line: get("--line", "#d5dfe3") };
}
const moneyTick = (v: number, max: number) => `${v < 0 ? "−" : ""}S$${Math.abs(v).toFixed(max < 1 ? 2 : max < 10 ? 1 : 0)}`;

function FleetChart({ data }: { data: Snap["series"] }) {
  if (data.length < 2) return <p className="py-10 text-center text-sm text-[var(--mut)]">Collecting data…</p>;
  const c = themeColors();
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.line} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.mut }} tickLine={false} axisLine={{ stroke: c.line }} minTickGap={40} />
          <YAxis tick={{ fontSize: 11, fill: c.mut }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="stepAfter" dataKey="working" name="Working" stackId="f" stroke="none" fill={c.idle} fillOpacity={1} isAnimationActive={false} />
          <Area type="stepAfter" dataKey="idle" name="Idle, waiting" stackId="f" stroke="none" fill={c.idle} fillOpacity={0.35} isAnimationActive={false} />
          <Area type="stepAfter" dataKey="in_use" name="In use" stackId="f" stroke="none" fill={c.use} fillOpacity={1} isAnimationActive={false} />
          <Area type="stepAfter" dataKey="asleep" name="Asleep or off" stackId="f" stroke="none" fill={c.sleep} fillOpacity={1} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MoneyChart({ data }: { data: Snap["series"] }) {
  if (data.length < 2) return <p className="py-10 text-center text-sm text-[var(--mut)]">Collecting data…</p>;
  const c = themeColors();
  const max = Math.max(...data.map((p) => Number(p.revenue) || 0));
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.line} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.mut }} tickLine={false} axisLine={{ stroke: c.line }} minTickGap={40} />
          <YAxis tick={{ fontSize: 11, fill: c.mut }} tickLine={false} axisLine={false} tickFormatter={(v) => moneyTick(Number(v), max)} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => sgd(Number(v))} />
          <Line type="monotone" dataKey="revenue" name="Customers paid" stroke={c.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="payouts" name="Paid to contributors" stroke={c.mut} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="profit" name="Nightshift profit" stroke={c.idle} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Legend({ items }: { items: [string, string, number?][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--mut)]">
      {items.map(([name, color, op]) => (
        <span key={name} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color, opacity: op ?? 1 }} />{name}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- overview
const EVENT_DOT = { good: "bg-[var(--idle)]", warn: "bg-[var(--amber)]", bad: "bg-[var(--bad)]" } as const;
const LUT: [number, number, number][] = Array.from({ length: MAX_ITER + 1 }, (_, i) => {
  if (i >= MAX_ITER) return [10, 24, 30];
  const t = Math.sqrt(i / MAX_ITER), h = 200 - 155 * t, l = 14 + 70 * t, a = (0.55 * Math.min(l, 100 - l)) / 100;
  const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
});

function Preview({ m, id, version }: { m: Market; id: string; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const o = m.orders.get(id), canvas = ref.current;
    if (!o?.image || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(IMAGE, IMAGE);
    for (let p = 0; p < o.image.length; p++) {
      const c = o.image[p] === 0 ? [30, 52, 60] : LUT[o.image[p]];
      img.data[p * 4] = c[0]; img.data[p * 4 + 1] = c[1]; img.data[p * 4 + 2] = c[2]; img.data[p * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [m, id, version]);
  return <canvas ref={ref} width={IMAGE} height={IMAGE} className="aspect-square w-full rounded-md bg-[#0b1a20]" aria-label="Result preview" />;
}

function Overview({ s, m }: { s: Snap; m: Market }) {
  const k = s.kpi;
  return (
    <>
      <Kpis items={[
        { v: sgd(k.revenue), l: "Customers paid", sub: "After late refunds" },
        { v: sgd(k.payouts), l: "Paid to contributors", sub: `Nightshift keeps ${pct(s.cfg.take_rate)}` },
        { v: sgd(k.electricity), l: "Contributor electricity", sub: `At S$${s.cfg.electricity.toFixed(2)}/kWh` },
        { v: sgd(k.profit), l: "Nightshift profit", sub: `${pct(k.margin)} margin`, tone: k.profit < 0 ? "bad" : "good" },
        { v: sgd(k.profit_per_month, 0), l: "Profit per month", sub: "At the current pace" },
        { v: `×${k.surge.toFixed(2)}`, l: "GPU surge", sub: `${k.backlog_gpu.toFixed(1)} GPU-h waiting`, tone: k.surge > 1.5 ? "warn" : undefined },
      ]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Fleet availability" sub="Devices by state, over simulated time."
          right={<Legend items={[["Working", "var(--idle)"], ["Idle", "var(--idle)", 0.35], ["In use", "var(--use)"], ["Off", "var(--sleep)"]]} />}>
          <FleetChart data={s.series} />
        </Panel>
        <Panel title="Money so far" sub="Running totals since the simulation started."
          right={<Legend items={[["Customers paid", "var(--ink)"], ["Contributors", "var(--mut)"], ["Profit", "var(--idle)"]]} />}>
          <MoneyChart data={s.series} />
        </Panel>
      </div>
      <Panel title="Latest orders" sub="CPU orders render a Mandelbrot tile as their stand-in workload. GPU batches fill in as tasks finish."
        right={<span className="text-xs text-[var(--mut)]">{s.orders.filter((o) => o.status === "running").length} running</span>}>
        {!s.orders.length ? <p className="py-6 text-center text-sm text-[var(--mut)]">Waiting for the first order…</p> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {s.orders.map((o) => (
              <div key={o.id} className="flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2.5 transition-colors hover:border-[color-mix(in_srgb,var(--idle)_45%,var(--line))]">
                {o.kind === "cpu" ? <Preview m={m} id={o.id} version={o.version} /> : (
                  <div className="grid aspect-square grid-cols-4 gap-1 rounded-md bg-[#0b1a20] p-2" aria-label="GPU batch progress">
                    {Array.from({ length: Math.min(o.total, 16) }, (_, i) => (
                      <i key={i} className={`rounded-sm ${i < Math.round((Math.min(o.total, 16) * o.done) / o.total) ? "bg-[#3cbfae]" : "bg-[#1e343c]"}`} />
                    ))}
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <b className="truncate text-[13px] font-semibold">{o.buyer}</b>
                  <span className="shrink-0 rounded bg-[var(--sleep)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--mut)]">{o.kind}</span>
                </div>
                <div className="flex justify-between text-xs text-[var(--mut)]">
                  <span className="tabular-nums">{o.hours} {o.kind === "cpu" ? "core-h" : "GPU-h"}{o.surge > 1 ? ` · ×${o.surge}` : ""}</span>
                  <span className="font-medium tabular-nums text-[var(--ink)]">{sgd(o.price, 3)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-[var(--sleep)]"><i className="block h-full rounded-full bg-[var(--idle)] transition-[width] duration-500" style={{ width: `${(100 * o.done) / o.total}%` }} /></div>
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[var(--mut)]">
                  <span className="tabular-nums">{o.done}/{o.total} · due {o.due.split(", ")[1]}</span>
                  <Status s={o.overdue ? "overdue" : o.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Activity" sub="Most recent first.">
        <ol className="relative max-h-[340px] overflow-y-auto pl-1">
          {s.events.map((e, i) => (
            <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
              {i < s.events.length - 1 && <span className="absolute left-[4px] top-3 h-full w-px bg-[var(--line)]" aria-hidden="true" />}
              <span className={`relative mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full ring-2 ring-[var(--surf)] ${EVENT_DOT[e.kind as keyof typeof EVENT_DOT] ?? "bg-[var(--use)]"}`} aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4">
                <span className={`text-[13px] ${e.kind === "bad" ? "font-medium text-[var(--bad)]" : ""}`}>{e.msg}</span>
                <time className="shrink-0 text-xs tabular-nums text-[var(--mut)]">{e.t}</time>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- settings
const SLIDERS: [keyof Config, string, number, number, number, (v: number) => string, string][] = [
  ["take_rate", "Nightshift's cut", 0, 0.6, 0.01, pct, "Share of what customers pay that Nightshift keeps."],
  ["cpu_price", "CPU price", 0.005, 0.06, 0.001, (v) => `S$${v.toFixed(3)}/core-h`, "Cloud spot CPU is roughly S$0.01–0.03."],
  ["gpu_price", "GPU price", 0.1, 1, 0.01, (v) => `S$${v.toFixed(2)}/GPU-h`, "Consumer GPU marketplaces are roughly S$0.30–0.70."],
  ["surge_max", "GPU surge cap", 1, 3, 0.1, (v) => `×${v.toFixed(1)}`, "How far GPU prices can rise when GPUs are scarce."],
  ["electricity", "Electricity rate", 0.1, 0.6, 0.01, (v) => `S$${v.toFixed(2)}/kWh`, "Paid by contributors."],
  ["verify_share", "Results rechecked", 0, 0.3, 0.01, pct, "Rerun on another device, after each device's first results."],
  ["verify_first_n", "Always check first", 0, 10, 1, (v) => `${v} results`, "Per new device."],
  ["late_refund", "Late-delivery refund", 0, 1, 0.05, pct, "Paid by Nightshift when an order misses its deadline."],
  ["demand", "Customer demand", 0.2, 3, 0.1, (v) => `×${v.toFixed(1)}`, "Scales how often customers order."],
  ["cheater_share", "Cheating devices", 0, 0.3, 0.01, pct, "Share of simulated devices returning bad results."],
];

function Settings({ s, m, refresh }: { s: Snap; m: Market; refresh: () => void }) {
  const [fleet, setFleet] = useState(s.cfg.fleet);
  return (
    <>
      <div className="card">
        <h3 className="card-title mb-3">Scenarios</h3>
        <p className="mb-3 text-xs text-[var(--mut)]">Each scenario resets the assumptions to defaults, then applies its change.</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SCENARIOS).map(([id, sc]) => (
            <button key={id} aria-pressed={s.scenario === id} className={`${BTN} ${s.scenario === id ? "border-[var(--idle)] bg-[color-mix(in_srgb,var(--idle)_12%,transparent)] text-[var(--idle)]" : ""}`}
              onClick={() => { m.applyScenario(id); setFleet(m.cfg.fleet); refresh(); }}>{sc.label}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <h3 className="card-title mb-3">Assumptions</h3>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {SLIDERS.map(([key, label, min, max, step, fmt, hint]) => (
            <div key={key}>
              <label htmlFor={`mk-${key}`} className="mb-1 flex items-center justify-between gap-2 text-[13px] font-medium">{label}
                <output className="rounded-md bg-[color-mix(in_srgb,var(--idle)_12%,transparent)] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--idle)]">{fmt(Number(s.cfg[key]))}</output></label>
              <input id={`mk-${key}`} type="range" min={min} max={max} step={step} value={Number(s.cfg[key])}
                className="w-full accent-[var(--idle)]" onChange={(e) => { m.applyConfig({ [key]: Number(e.target.value) }); refresh(); }} />
              <p className="mt-0.5 text-xs text-[var(--mut)]">{hint}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h3 className="card-title mb-3">Simulated fleet</h3>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(CLASSES) as DeviceClass[]).map((c) => (
              <label key={c} className="text-xs text-[var(--mut)]">{CLASSES[c].label}s
                <input type="number" min={0} max={2000} value={fleet[c]}
                  onChange={(e) => setFleet({ ...fleet, [c]: Number(e.target.value) })}
                  className={INPUT} />
              </label>
            ))}
          </div>
          <button className={`${BTN_PRIMARY} mt-3`} onClick={() => { m.applyConfig({ fleet }); refresh(); }}>Apply fleet</button>
          <label className="mt-5 flex cursor-pointer items-center gap-2.5 border-t border-[var(--line)] pt-4 text-[13px] font-medium">
            <Toggle checked={s.cfg.live_fleet} onChange={(v) => { m.applyConfig({ live_fleet: v }); refresh(); }} label="Include my enrolled devices" />
            Include my enrolled devices
          </label>
          <p className="text-xs text-[var(--mut)]">Your devices join with their real idle status, refreshed every 30 seconds. Their work in the market is modelled; nothing runs on them.</p>
        </div>
        <div className="card">
          <h3 className="card-title mb-3">Economics by device type</h3>
          <table className="table table-sm">
            <thead><tr><th>Type</th><th className="text-right">Devices</th><th className="text-right">Contributor net / month</th><th className="text-right">Nightshift fee / month</th></tr></thead>
            <tbody>{s.classes.map((c) => (
              <tr key={c.cls}><td>{c.label}</td><td className="text-right tabular-nums">{c.count}</td>
                <td className="text-right tabular-nums">{sgd(c.net_per_month)}</td><td className="text-right tabular-nums">{sgd(c.fees_per_month)}</td></tr>
            ))}</tbody>
          </table>
          <p className="mt-2 text-xs text-[var(--mut)]">Per device, after electricity, at the current pace.</p>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- customers
function Customers({ s, m, refresh }: { s: Snap; m: Market; refresh: () => void }) {
  const [buyer, setBuyer] = useState("Demo Buyer Pte Ltd");
  const [kind, setKind] = useState<Kind>("cpu");
  const [hours, setHours] = useState(12);
  const [deadline, setDeadline] = useState(8);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [filter, setFilter] = useState("");
  const q = m.quote(kind, hours > 0 ? hours : 1);
  const eta = q.eta_hours === null ? "No capacity now" : q.eta_hours < 1 ? `${Math.round(q.eta_hours * 60)} min` : `${q.eta_hours.toFixed(1)} h`;
  const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
  const busy = (b: Snap["buyers"][number]) => !b.hours.length ? "When you order"
    : b.hours.some(([a, z]) => a === 0 && z === 24) ? "All day" : b.hours.map(([a, z]) => `${hh(a)}–${hh(z)}`).join(", ");
  const invoices = m.invoices(filter || undefined).slice(0, 50);
  const input = INPUT;
  return (
    <>
      <div className="card">
        <h3 className="card-title mb-3">Order compute</h3>
        <p className="mb-3 text-xs text-[var(--mut)]">Get a quote and place an order as a customer. Prices and delivery come from the live market.</p>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-medium text-[var(--mut)]">Company<input className={input} value={buyer} maxLength={60} onChange={(e) => setBuyer(e.target.value)} /></label>
          <label className="text-xs font-medium text-[var(--mut)]">Workload<select className={input} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="cpu">CPU batch (render, simulation)</option><option value="gpu">GPU inference</option></select></label>
          <label className="text-xs font-medium text-[var(--mut)]">{kind === "cpu" ? "Core-hours" : "GPU-hours"}<input className={input} type="number" min={0.25} max={500} step={0.25} value={hours} onChange={(e) => setHours(Number(e.target.value))} /></label>
          <label className="text-xs font-medium text-[var(--mut)]">Needed within (hours)<input className={input} type="number" min={1} max={72} value={deadline} onChange={(e) => setDeadline(Number(e.target.value))} /></label>
          <button className={BTN_PRIMARY} onClick={() => {
            if (!buyer.trim()) { setNote({ text: "Enter a company name.", ok: false }); return; }
            if (!(hours > 0) || !(deadline > 0)) { setNote({ text: "Hours and deadline must be above zero.", ok: false }); return; }
            const o = m.placeOrder(buyer.trim(), hours, deadline, kind);
            if (o) setNote({ text: `Order ${o.id} placed for ${sgd(o.price, 3)}. Track it on the Overview tab.`, ok: true });
            refresh();
          }}>Place order</button>
        </div>
        <div className="mt-4 grid divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-[var(--bg)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {([[sgd(q.price, 3), "Total price"],
            [sgd(q.unit_price, 3), `Per ${kind === "cpu" ? "core" : "GPU"}-hour${q.surge > 1 ? ` (surge ×${q.surge})` : ""}`],
            [eta, "Estimated delivery at current capacity"]] as [string, string][]).map(([v, l]) => (
            <div key={l} className="px-4 py-3">
              <span className="block text-xs text-[var(--mut)]">{l}</span>
              <b className="mt-1 block text-lg font-semibold tabular-nums">{v}</b>
            </div>
          ))}
        </div>
        {(q.eta_hours === null || q.eta_hours > deadline) && <p className="mt-2 text-xs text-[var(--amber)]">Likely to miss this deadline at current capacity. Late orders get a partial refund.</p>}
        {note && <p className={`mt-2 text-xs ${note.ok ? "text-[var(--idle)]" : "text-[var(--bad)]"}`} aria-live="polite">{note.text}</p>}
      </div>

      <div className="card">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="card-title">Customers</h3>
          <span className="text-xs text-[var(--mut)]">{s.buyers.filter((b) => b.enabled && b.status === "active").length} of {s.buyers.length} ordering</span>
        </div>
        <p className="mb-3 text-xs text-[var(--mut)]">Each customer orders at its own busy hours, with its own order sizes, deadlines and price limits. Switch one off to see how the market does without it.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {s.buyers.map((b) => (
            <div key={b.name} className={`flex flex-col gap-3 rounded-lg border bg-[var(--bg)] p-4 ${b.manual ? "border-[var(--idle)]" : "border-[var(--line)]"} ${b.enabled ? "" : "opacity-55"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <b className="block truncate text-sm font-semibold" title={b.name}>{b.name}</b>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--mut)]">{b.segment} <Status s={!b.enabled ? "switched off" : b.status} /></span>
                </div>
                <span className="shrink-0 rounded bg-[var(--sleep)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--mut)]">{b.kind}</span>
              </div>
              <p className="text-xs text-[var(--mut)]">{b.what}. {b.note}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <dt className="text-[var(--mut)]">Busy hours</dt><dd className="text-right tabular-nums">{busy(b)}</dd>
                <dt className="text-[var(--mut)]">Typical order</dt><dd className="text-right tabular-nums">{b.size[0]}–{b.size[1]} {b.kind === "cpu" ? "core-h" : "GPU-h"}</dd>
                <dt className="text-[var(--mut)]">Needs it within</dt><dd className="text-right tabular-nums">{b.deadline_h} h</dd>
                <dt className="text-[var(--mut)]">Pays</dt><dd className="text-right tabular-nums">{b.premium === 1 ? "market price" : `${b.premium > 1 ? "+" : "−"}${Math.abs(Math.round((b.premium - 1) * 100))}% vs market`}</dd>
                {b.max_surge && <><dt className="text-[var(--mut)]">Stops buying above</dt><dd className="text-right tabular-nums">×{b.max_surge} surge</dd></>}
                <dt className="text-[var(--mut)]">Satisfaction</dt>
                <dd className="flex justify-end"><span className="mt-1 h-1.5 w-16 overflow-hidden rounded bg-[var(--sleep)]"><i className="block h-full bg-[var(--idle)]" style={{ width: `${b.satisfaction * 100}%` }} /></span></dd>
              </dl>
              <div className="grid grid-cols-4 gap-1 border-y border-[var(--line)] py-2 text-center">
                {[[b.orders, "Orders"], [`${b.delivered - b.late}/${b.delivered}`, "On time"], [b.declined, "Declined"], [sgd(b.spent), "Spent"]].map(([v, l]) => (
                  <div key={String(l)}><b className="block text-sm font-semibold tabular-nums">{v}</b><span className="text-[10px] uppercase tracking-wide text-[var(--mut)]">{l}</span></div>
                ))}
              </div>
              {!b.manual && (
                <div className="mt-auto flex items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <Toggle checked={b.enabled} onChange={(v) => { m.toggleBuyer(b.name, v); refresh(); }} label={`${b.name} in market`} /> In market
                  </label>
                  <button className={BTN} onClick={() => { m.placeOrder(b.name); refresh(); }}>Order now</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="card-title">Invoices</h3>
          <span className="flex gap-2">
            <select aria-label="Filter by customer" className="input h-8 w-auto text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All customers</option>{s.buyers.map((b) => <option key={b.name}>{b.name}</option>)}
            </select>
            <button className={BTN} onClick={() => download("nightshift-market-invoices.csv", m.invoices())}>Export CSV</button>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="table table-sm whitespace-nowrap">
            <thead><tr>{["Order", "Customer", "Placed", "Delivered", "Hours", "Unit price", "Price", "Refund", "Net", "Status"].map((h, i) => <th key={h} className={`${i >= 4 && i <= 8 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {invoices.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td><td>{o.buyer}</td><td>{o.created}</td><td>{o.delivered || "—"}</td>
                  <td className="text-right tabular-nums">{o.hours}</td><td className="text-right tabular-nums">{sgd(o.unit_price, 3)}</td>
                  <td className="text-right tabular-nums">{sgd(o.price, 3)}</td><td className="text-right tabular-nums">{o.refund ? sgd(-o.refund, 3) : "—"}</td>
                  <td className="text-right tabular-nums">{sgd(o.price - o.refund, 3)}</td>
                  <td><Status s={o.overdue ? "overdue" : o.status} /></td>
                </tr>
              ))}
              {!invoices.length && <tr><td colSpan={10} className="py-6 text-center text-[var(--mut)]">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- contributors
function Contributors({ s }: { s: Snap }) {
  const [sel, setSel] = useState<string>("");
  const st = s.devices.find((d) => d.id === sel) ?? s.devices[0];
  const groups: [string, string][] = [["live", "Your devices"], ["sim", "Simulated contributors"]];
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <div className="card xl:col-span-2">
        <h3 className="card-title mb-3">Payout statement</h3>
        <select aria-label="Device" className="input mb-4" value={st?.id ?? ""} onChange={(e) => setSel(e.target.value)}>
          {groups.map(([k, label]) => {
            const opts = s.devices.filter((d) => d.kind === k);
            return opts.length ? <optgroup key={k} label={label}>{opts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup> : null;
          })}
        </select>
        {st && (
          <>
            <p className="mb-3"><span className="flex items-center gap-2"><b className="text-[15px] font-semibold">{st.name}</b> <Status s={st.state} /></span>
              <span className="text-xs text-[var(--mut)]">{st.label} · {st.cores} cores · ~{st.watts} W under load · joined {st.joined}</span></p>
            <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-[13px]">
              {([["Tasks finished", String(st.done)], ["Hours worked", `${st.hours.toFixed(2)} h`], ["Customers paid for this device's work", sgd(st.gross, 3)],
                [`Nightshift fee (${pct(s.cfg.take_rate)})`, sgd(-st.fees, 3)], ["Payout", sgd(st.earned, 3)],
                [`Electricity (S$${s.cfg.electricity.toFixed(2)}/kWh)`, sgd(-st.electricity, 3)]] as [string, string][]).map(([l, v]) => (
                <div key={l} className="contents"><dt>{l}</dt><dd className="text-right tabular-nums">{v}</dd></div>
              ))}
              <dt className="border-t border-[var(--line)] pt-1 font-semibold">Net to contributor</dt>
              <dd className={`border-t border-[var(--line)] pt-1 text-right tabular-nums font-semibold ${st.net < 0 ? "text-[var(--bad)]" : ""}`}>{sgd(st.net, 3)}</dd>
              <dt className="text-[var(--mut)]">Projected per month</dt><dd className="text-right tabular-nums text-[var(--mut)]">{sgd(st.net_per_month)}</dd>
              <dt className="text-[var(--mut)]">Reliability score</dt><dd className="text-right tabular-nums text-[var(--mut)]">{st.reliability}/100</dd>
            </dl>
          </>
        )}
      </div>
      <div className="card xl:col-span-3">
        <h3 className="card-title mb-3">Top earners</h3>
        <div className="overflow-x-auto">
          <table className="table table-sm whitespace-nowrap">
            <thead><tr><th>Device</th><th>State</th><th className="text-right">Tasks</th><th className="text-right">Payout</th><th className="text-right">Net / month</th></tr></thead>
            <tbody>{s.devices.slice(0, 25).map((d) => (
              <tr key={d.id} className={`${d.kind === "live" ? "bg-[color-mix(in_srgb,var(--idle)_9%,transparent)]" : ""}`}>
                <td>{d.name}</td><td><Status s={d.state} /></td>
                <td className="text-right tabular-nums">{d.done}</td><td className="text-right tabular-nums">{sgd(d.earned, 3)}</td>
                <td className={`text-right tabular-nums ${d.net_per_month < 0 ? "text-[var(--bad)]" : ""}`}>{sgd(d.net_per_month)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- trust
function Trust({ s }: { s: Snap }) {
  const t = s.trust;
  const suspended = s.devices.filter((d) => d.state === "suspended");
  const shaky = s.devices.filter((d) => d.state !== "suspended" && d.done + d.preempted > 0).sort((a, b) => a.reliability - b.reliability).slice(0, 8);
  return (
    <>
      <Kpis items={[
        { v: t.checks.toLocaleString(), l: "Results rechecked" },
        { v: String(t.caught), l: "Cheating devices caught", tone: "good" },
        { v: String(t.undetected), l: "Bad results that got through", tone: t.undetected ? "bad" : undefined },
        { v: sgd(t.verify_cost), l: "Cost of rechecking" },
        { v: pct(t.results ? t.checks / t.results : 0), l: "Share of results rechecked" },
        { v: String(suspended.length), l: "Devices suspended" },
      ]} />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h3 className="card-title mb-4">How results are checked</h3>
          <ol className="flex flex-col gap-4">
            {([
              ["Recheck new devices", `Each device's first ${s.cfg.verify_first_n} results are rerun on another idle device.`],
              ["Spot-check everyone", `After that, ${pct(s.cfg.verify_share)} of results are picked at random and rerun.`],
              ["Suspend on a mismatch", "A wrong result suspends the device without pay, and the task is rerun elsewhere."],
            ] as [string, string][]).map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--idle)_14%,transparent)] text-xs font-semibold text-[var(--idle)]">{i + 1}</span>
                <div><p className="text-[13px] font-medium">{t}</p><p className="text-[13px] text-[var(--mut)]">{d}</p></div>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-lg bg-[var(--bg)] px-3 py-2.5 text-xs text-[var(--mut)]">
            Checking more catches cheats sooner but costs more. Try the <b className="text-[var(--ink)]">Lean verification</b> scenario to see bad results slip through.
          </p>
        </div>
        <div className="card">
          <h3 className="card-title mb-3">Least reliable active devices</h3>
          <table className="table table-sm">
            <thead><tr><th>Device</th><th className="text-right">Score</th><th className="text-right">Finished</th><th className="text-right">Interrupted</th></tr></thead>
            <tbody>
              {shaky.map((d) => <tr key={d.id}><td>{d.name}</td><td className="text-right tabular-nums">{d.reliability}</td><td className="text-right tabular-nums">{d.done}</td><td className="text-right tabular-nums">{d.preempted}</td></tr>)}
              {!shaky.length && <tr><td colSpan={4} className="py-4 text-center text-[var(--mut)]">No devices have worked yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- report
type SavedRun = ReturnType<Market["summary"]>;
function loadRuns(): SavedRun[] {
  try { return JSON.parse(localStorage.getItem(RUNS_KEY) || "[]"); } catch { return []; }
}

function Report({ s, m }: { s: Snap; m: Market }) {
  const [runs, setRuns] = useState<SavedRun[]>(loadRuns);
  const [label, setLabel] = useState("");
  const k = s.kpi, c = s.cfg;
  const rows: [string, string][] = [
    ["Customers paid (before refunds)", sgd(k.gross)], ["Paid to contributors", sgd(-k.payouts)],
    ["Late-delivery refunds", sgd(-k.refunds)], ["Rechecking results", sgd(-k.verify_cost)],
  ];
  return (
    <>
      <div className="card print:hidden">
        <h3 className="card-title mb-3">Save and export</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 text-xs font-medium text-[var(--mut)]">Run name
            <input className={INPUT} placeholder="e.g. 200 devices, premium GPU"
              value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} /></label>
          <button className={BTN_PRIMARY} onClick={() => {
            const next = [m.summary(label), ...runs].slice(0, 20);
            setRuns(next);
            try { localStorage.setItem(RUNS_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
          }}>Save this run</button>
          <button className={BTN} onClick={() => window.print()}>Print or save as PDF</button>
          <button className={BTN} onClick={() => download("nightshift-market-invoices.csv", m.invoices())}>Invoices CSV</button>
          <button className={BTN} onClick={() => download("nightshift-market-payouts.csv", m.deviceRows())}>Payouts CSV</button>
          <button className={BTN} onClick={() => download("nightshift-market-timeseries.csv", m.series)}>Time series CSV</button>
        </div>
      </div>
      <div className="card">
        <h2 className="text-base font-semibold tracking-tight">Nightshift market: run report</h2>
        <p className="mb-3 text-xs text-[var(--mut)]">{SCENARIOS[s.scenario]?.label ?? "Custom"} · {s.days.toFixed(1)} simulated days · {k.devices} devices · simulated data, no real money</p>
        <Kpis items={[
          { v: sgd(k.revenue), l: "Customers paid" }, { v: sgd(k.payouts), l: "Paid to contributors" },
          { v: sgd(k.profit), l: `Nightshift profit (${pct(k.margin)})`, tone: k.profit < 0 ? "bad" : "good" },
          { v: sgd(k.profit_per_month, 0), l: "Profit per month" }, { v: sgd(k.profit_per_device_month), l: "Profit per device per month" },
          { v: `${s.buyers.reduce((a, b) => a + b.delivered - b.late, 0)}/${s.buyers.reduce((a, b) => a + b.delivered, 0)}`, l: "Orders on time" },
        ]} />
        <div className="mt-4 grid gap-6 text-sm md:grid-cols-3">
          <div><h4 className="mb-1 text-xs font-semibold text-[var(--mut)]">Where the money went</h4>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1">{rows.map(([l, v]) => <div key={l} className="contents"><dt>{l}</dt><dd className="text-right tabular-nums">{v}</dd></div>)}
              <dt className="border-t border-[var(--line)] pt-1 font-semibold">Nightshift profit</dt><dd className="border-t border-[var(--line)] pt-1 text-right tabular-nums font-semibold">{sgd(k.profit)}</dd></dl></div>
          <div><h4 className="mb-1 text-xs font-semibold text-[var(--mut)]">Customers by spend</h4>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1">{[...s.buyers].filter((b) => b.orders || b.declined).sort((a, b) => b.spent - a.spent).map((b) => (
              <div key={b.name} className="contents"><dt>{b.name} <span className="text-xs text-[var(--mut)]">{b.delivered - b.late}/{b.delivered} on time{b.declined ? `, ${b.declined} declined` : ""}</span></dt><dd className="text-right tabular-nums">{sgd(b.spent)}</dd></div>
            ))}</dl></div>
          <div><h4 className="mb-1 text-xs font-semibold text-[var(--mut)]">Contributors (net per month) and assumptions</h4>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1">
              {s.classes.map((x) => <div key={x.cls} className="contents"><dt>{x.label} ({x.count})</dt><dd className="text-right tabular-nums">{sgd(x.net_per_month)}</dd></div>)}
              <dt className="border-t border-[var(--line)] pt-1">Nightshift&apos;s cut</dt><dd className="border-t border-[var(--line)] pt-1 text-right tabular-nums">{pct(c.take_rate)}</dd>
              <dt>CPU / GPU price</dt><dd className="text-right tabular-nums">S${c.cpu_price} · S${c.gpu_price}</dd>
              <dt>Results rechecked</dt><dd className="text-right tabular-nums">{pct(c.verify_share)} + first {c.verify_first_n}</dd>
            </dl></div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div><h4 className="mb-1 text-xs font-semibold text-[var(--mut)]">Fleet availability</h4><FleetChart data={s.series} /></div>
          <div><h4 className="mb-1 text-xs font-semibold text-[var(--mut)]">Money so far</h4><MoneyChart data={s.series} /></div>
        </div>
      </div>
      <div className="card print:hidden">
        <h3 className="card-title mb-3">Saved runs <span className="text-xs font-normal text-[var(--mut)]">(stored in this browser)</span></h3>
        <div className="overflow-x-auto">
          <table className="table table-sm whitespace-nowrap">
            <thead><tr><th>Run</th><th className="text-right">Sim days</th><th className="text-right">Devices</th><th className="text-right">Customers paid</th><th className="text-right">Profit</th><th className="text-right">Margin</th><th className="text-right">Profit / month</th></tr></thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i}><td>{r.label}</td><td className="text-right tabular-nums">{r.sim_days}</td>
                  <td className="text-right tabular-nums">{r.kpi.devices}</td><td className="text-right tabular-nums">{sgd(r.kpi.revenue)}</td>
                  <td className="text-right tabular-nums">{sgd(r.kpi.profit)}</td><td className="text-right tabular-nums">{pct(r.kpi.margin)}</td>
                  <td className="text-right tabular-nums">{sgd(r.kpi.profit_per_month, 0)}</td></tr>
              ))}
              {!runs.length && <tr><td colSpan={7} className="py-4 text-center text-[var(--mut)]">No saved runs yet. Save one to compare scenarios.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
