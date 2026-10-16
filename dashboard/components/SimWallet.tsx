"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AnimatedNumber from "@/components/AnimatedNumber";

// Simulated contributor wallet. Credits come from the viewer's real daily idle
// summaries (plus any nights they simulate here); withdrawals are pretend
// PayNow transfers. Nothing is written to the database and no money moves.
// Local state lives in this browser only.

const RATE_PER_CORE_HOUR = 0.014; // matches the Devices page estimate
const IDLE_POWER_DRAW_KW = 0.015;
const HOLD_DAYS = 7; // results are checked before earnings clear
const MIN_WITHDRAW = 5;
const PROCESSING_MS = 8000;
const DAY = 86400000;
const BTN = "rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100";

export type WalletDevice = { id: string; name: string; cores: number | null };
export type WalletSummary = { device_id: string; date: string; usable_idle_hours: number; core_hours: number };

type Night = { id: string; ts: number; hours: number; devices: { id: string; name: string; coreHours: number; idleHours: number }[] };
type Withdrawal = { id: string; ts: number; realTs: number; amount: number };
type Store = { offsetDays: number; nights: Night[]; withdrawals: Withdrawal[] };
type Credit = { id: string; ts: number; label: string; amount: number; byDevice: Map<string, number> };

const EMPTY: Store = { offsetDays: 0, nights: [], withdrawals: [] };
const sgd = (v: number) => `S$${v.toFixed(2)}`;
const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("en-SG", { day: "numeric", month: "short" });

// Deterministic sample history so the page is useful before any device reports.
function sampleSummaries(today: number): WalletSummary[] {
  const out: WalletSummary[] = [];
  for (let i = 30; i >= 1; i--) {
    const h = 3.5 + ((i * 37) % 45) / 10; // 3.5 to 8 hours
    out.push({ device_id: "sample", date: dayKey(today - i * DAY), usable_idle_hours: h, core_hours: h * 8 });
  }
  return out;
}

// Browser storage as an external store, so server and first client render agree.
const STORE_EVENT = "nightshift-sim-wallet";
function subscribeStore(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(STORE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(STORE_EVENT, cb);
  };
}
function readStore(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

// Wall clock, rounded to the tick so snapshots stay stable between ticks.
function useNow(everyMs: number) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const t = setInterval(cb, everyMs);
      return () => clearInterval(t);
    },
    [everyMs]
  );
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / everyMs) * everyMs, () => 0);
}

export default function SimWallet({
  userId,
  devices,
  summaries,
  electricityRate,
}: {
  userId: string;
  devices: WalletDevice[];
  summaries: WalletSummary[];
  electricityRate: number;
}) {
  const key = `nightshift-sim-wallet:${userId}`;
  const raw = useSyncExternalStore(subscribeStore, () => readStore(key), () => null);
  const mounted = raw !== null;
  const store = useMemo<Store>(() => {
    try {
      return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
    } catch {
      return EMPTY;
    }
  }, [raw]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const save = useCallback(
    (next: Store) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new Event(STORE_EVENT));
    },
    [key]
  );

  const busy = store.withdrawals.some((w) => w.realTs > 0) ? 1000 : 60000;
  const realNow = useNow(busy);
  const today = Math.floor(realNow / DAY) * DAY;

  const sample = devices.length === 0 || summaries.length === 0;
  const devs = useMemo<WalletDevice[]>(
    () => (sample ? [{ id: "sample", name: "Sample laptop", cores: 8 }] : devices),
    [sample, devices]
  );
  const rows = useMemo(() => (sample ? sampleSummaries(today) : summaries), [sample, summaries, today]);
  const nameOf = useMemo(() => new Map(devs.map((d) => [d.id, d.name])), [devs]);

  const now = realNow + store.offsetDays * DAY;

  const credits = useMemo<Credit[]>(() => {
    const net = (coreHours: number, idleHours: number) =>
      Math.max(0, coreHours * RATE_PER_CORE_HOUR - idleHours * IDLE_POWER_DRAW_KW * electricityRate);
    const byDay = new Map<string, Credit>();
    for (const r of rows) {
      const ts = new Date(r.date + "T23:00:00").getTime();
      const c = byDay.get(r.date) ?? { id: `d-${r.date}`, ts, label: "Idle compute earnings", amount: 0, byDevice: new Map() };
      const v = net(Number(r.core_hours), Number(r.usable_idle_hours));
      c.amount += v;
      c.byDevice.set(r.device_id, (c.byDevice.get(r.device_id) ?? 0) + v);
      byDay.set(r.date, c);
    }
    const sims = store.nights.map<Credit>((n) => {
      const byDevice = new Map<string, number>();
      let amount = 0;
      for (const d of n.devices) {
        const v = net(d.coreHours, d.idleHours);
        byDevice.set(d.id, v);
        amount += v;
      }
      return { id: n.id, ts: n.ts, label: `Simulated night (${n.hours.toFixed(1)} h idle)`, amount, byDevice };
    });
    return [...byDay.values(), ...sims].filter((c) => c.amount > 0).sort((a, b) => b.ts - a.ts);
  }, [rows, store.nights, electricityRate]);

  const clearsAt = (c: Credit) => c.ts + HOLD_DAYS * DAY;
  const isAvailable = (c: Credit) => clearsAt(c) <= now;
  const wStatus = (w: Withdrawal) => (realNow - w.realTs >= PROCESSING_MS || now - w.ts >= DAY ? "paid" : "processing");

  const earnedAvailable = credits.filter(isAvailable).reduce((a, c) => a + c.amount, 0);
  const pending = credits.filter((c) => !isAvailable(c)).reduce((a, c) => a + c.amount, 0);
  const withdrawn = store.withdrawals.reduce((a, w) => a + w.amount, 0);
  const processing = store.withdrawals.filter((w) => wStatus(w) === "processing").reduce((a, w) => a + w.amount, 0);
  const paidOut = withdrawn - processing;
  const available = Math.max(0, earnedAvailable - withdrawn);
  const lifetime = credits.reduce((a, c) => a + c.amount, 0);

  // Last 30 days of credits, one bar per day, split by whether it has cleared.
  const chart = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const ts = now - (29 - i) * DAY;
      return { key: dayKey(ts), label: fmtDate(ts), available: 0, pending: 0 };
    });
    const idx = new Map(days.map((d, i) => [d.key, i]));
    for (const c of credits) {
      const i = idx.get(dayKey(c.ts));
      if (i === undefined) continue;
      days[i][isAvailable(c) ? "available" : "pending"] += c.amount;
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credits, now]);

  const perDevice = devs.map((d) => {
    const earned = credits.reduce((a, c) => a + (c.byDevice.get(d.id) ?? 0), 0);
    const idle =
      rows.filter((r) => r.device_id === d.id).reduce((a, r) => a + Number(r.usable_idle_hours), 0) +
      store.nights.reduce((a, n) => a + (n.devices.find((x) => x.id === d.id)?.idleHours ?? 0), 0);
    return { ...d, earned, idle };
  });

  const activity = [
    ...credits.map((c) => ({
      id: c.id, ts: c.ts, label: c.label, amount: c.amount,
      status: isAvailable(c) ? "Available" : `Clears ${fmtDate(clearsAt(c))}`,
      tone: isAvailable(c) ? "good" : "pend",
    })),
    ...store.withdrawals.map((w) => ({
      id: w.id, ts: w.ts, label: `Withdrawal to PayNow · ${w.id}`, amount: -w.amount,
      status: wStatus(w) === "paid" ? "Paid" : "Processing", tone: wStatus(w) === "paid" ? "out" : "pend",
    })),
  ].sort((a, b) => b.ts - a.ts);

  function simulateNight() {
    const hours = 5 + Math.random() * 3;
    const night: Night = {
      id: `n-${Date.now().toString(36)}`,
      ts: now,
      hours,
      devices: devs.map((d) => ({ id: d.id, name: d.name, idleHours: hours, coreHours: hours * (d.cores || 4) })),
    };
    save({ ...store, nights: [...store.nights, night] });
    setNotice(`Simulated a ${hours.toFixed(1)} h night. Earnings clear after ${HOLD_DAYS} days of result checks.`);
  }

  function skipWeek() {
    save({ ...store, offsetDays: store.offsetDays + HOLD_DAYS });
    setNotice(`Skipped ahead ${HOLD_DAYS} days. Pending earnings older than that are now available.`);
  }

  function reset() {
    save(EMPTY);
    setWithdrawOpen(false);
    setNotice("Simulation reset.");
  }

  const amount = Number(amountText);
  const amountError =
    !amountText ? null
    : !Number.isFinite(amount) || amount <= 0 ? "Enter an amount."
    : amount < MIN_WITHDRAW ? `The minimum withdrawal is ${sgd(MIN_WITHDRAW)}.`
    : amount > available + 0.005 ? `You have ${sgd(available)} available.`
    : null;

  function withdraw() {
    if (amountError || !amountText) return;
    const ref = `NS-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const w: Withdrawal = { id: ref, ts: now, realTs: Date.now(), amount: Math.min(Math.round(amount * 100) / 100, available) };
    save({ ...store, withdrawals: [...store.withdrawals, w] });
    setWithdrawOpen(false);
    setAmountText("");
    setNotice(`${sgd(w.amount)} is on its way to PayNow. Reference ${ref}.`);
  }

  function exportCsv() {
    const head = ["date", "description", "amount_sgd", "status"];
    const cell = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = activity.map((a) => [dayKey(a.ts), a.label, a.amount.toFixed(4), a.status].map(cell).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "nightshift-simulated-wallet.csv" }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!mounted) return <div className="card h-64 animate-pulse" />;

  const shown = showAll ? activity : activity.slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      {sample && (
        <p className="rounded-lg border border-dashed border-[var(--line)] px-3 py-2 text-xs text-[var(--mut)]">
          No idle history from your devices yet, so this shows a sample 8-core laptop. Add a device on the Devices page to
          use your own hours.
        </p>
      )}

      {/* Balance */}
      <div className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--idle)_14%,transparent)] blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--mut)]">Available balance</p>
            <b className="mt-1 block text-4xl font-bold tracking-tight tabular-nums">
              <AnimatedNumber value={available} decimals={2} prefix="S$" />
            </b>
            <p className="mt-1 text-xs text-[var(--mut)]">Lifetime earned {sgd(lifetime)}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setWithdrawOpen((o) => !o);
                setAmountText(available >= MIN_WITHDRAW ? (Math.floor(available * 100) / 100).toFixed(2) : "");
                setNotice(null);
              }}
              disabled={available < MIN_WITHDRAW}
              title={available < MIN_WITHDRAW ? `You need at least ${sgd(MIN_WITHDRAW)} available` : undefined}
              className="rounded-lg bg-[var(--idle)] px-4 py-2 text-sm font-semibold text-[var(--on)] transition-[filter,transform] hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Withdraw
            </button>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-4 text-sm">
          <Stat label="Pending" value={pending} hint={`Clears after ${HOLD_DAYS} days`} dot="var(--chart-pend)" />
          <Stat label="Processing" value={processing} hint="On its way" />
          <Stat label="Paid out" value={paidOut} hint="To PayNow" />
        </div>

        {withdrawOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              withdraw();
            }}
            className="relative mt-5 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4"
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-[var(--mut)]">
                Amount (S$)
                <input
                  autoFocus
                  inputMode="decimal"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="h-10 w-36 rounded-lg border border-[var(--line)] bg-[var(--surf)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--idle)]"
                />
              </label>
              <div className="flex flex-col gap-1 text-xs text-[var(--mut)]">
                To
                <span className="flex h-10 items-center rounded-lg border border-[var(--line)] bg-[var(--surf)] px-3 text-sm text-[var(--ink)]">
                  PayNow · registered mobile
                </span>
              </div>
              <button type="submit" disabled={!!amountError || !amountText} className="h-10 rounded-lg bg-[var(--ink)] px-4 text-sm font-medium text-[var(--bg)] disabled:opacity-50">
                Confirm withdrawal
              </button>
              <button type="button" onClick={() => setWithdrawOpen(false)} className="h-10 px-2 text-sm text-[var(--mut)] hover:text-[var(--ink)]">
                Cancel
              </button>
            </div>
            <p className={`mt-2 text-xs ${amountError ? "text-[var(--bad)]" : "text-[var(--mut)]"}`}>
              {amountError ?? `Minimum ${sgd(MIN_WITHDRAW)}. Simulated transfer, no money moves.`}
            </p>
          </form>
        )}

        {notice && (
          <p role="status" className="relative mt-4 text-xs text-[var(--idle)]">
            {notice}
          </p>
        )}
      </div>

      {/* Simulation controls */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Try it out</h3>
          <p className="text-xs text-[var(--mut)]">
            {store.offsetDays > 0 ? `Simulated clock is ${store.offsetDays} days ahead. ` : ""}
            Add a night of idle time, or jump forward so pending earnings clear.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={simulateNight} className={BTN}>Simulate tonight</button>
          <button type="button" onClick={skipWeek} className={BTN}>Skip ahead {HOLD_DAYS} days</button>
          <button type="button" onClick={reset} className={`${BTN} text-[var(--mut)]`}>Reset</button>
        </div>
      </div>

      {/* Earnings chart */}
      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Daily earnings, last 30 days</h3>
          <div className="flex gap-4 text-xs text-[var(--mut)]">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-avail)]" />Available</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-pend)]" />Pending</span>
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.6} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--mut)" }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 11, fill: "var(--mut)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} width={52} />
              <Tooltip
                cursor={{ fill: "var(--line)", fillOpacity: 0.4 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof chart)[number];
                  return (
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--surf)] px-3 py-2 text-xs shadow-lg">
                      <b className="block text-[var(--ink)]">{label}</b>
                      {p.available > 0 && <span className="block text-[var(--ink)]">Available {sgd(p.available)}</span>}
                      {p.pending > 0 && <span className="block text-[var(--ink)]">Pending {sgd(p.pending)}</span>}
                      {!p.available && !p.pending && <span className="block text-[var(--mut)]">No earnings</span>}
                    </div>
                  );
                }}
              />
              <Bar dataKey="available" stackId="a" fill="var(--chart-avail)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              <Bar dataKey="pending" stackId="a" fill="var(--chart-pend)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Per-device */}
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold">By device</h3>
          <ul className="flex flex-col gap-3">
            {perDevice.map((d) => (
              <li key={d.id} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span className="truncate">{nameOf.get(d.id)}</span>
                  <b className="tabular-nums">{sgd(d.earned)}</b>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--sleep)]">
                  <div className="h-full rounded-full bg-[var(--chart-avail)]" style={{ width: `${lifetime ? (d.earned / lifetime) * 100 : 0}%` }} />
                </div>
                <span className="text-xs text-[var(--mut)]">
                  {d.idle.toFixed(1)} h idle · {d.cores ?? "?"} cores
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[var(--mut)]">
            Core-hours × S${RATE_PER_CORE_HOUR} minus electricity at S${electricityRate.toFixed(2)}/kWh.
          </p>
        </div>

        {/* Activity */}
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Activity</h3>
            {activity.length > 0 && (
              <button type="button" onClick={exportCsv} className={BTN}>Export CSV</button>
            )}
          </div>
          {!activity.length ? (
            <p className="text-sm text-[var(--mut)]">No activity yet. Simulate a night to get started.</p>
          ) : (
            <ul>
              {shown.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 text-sm last:border-0">
                  <div className="min-w-0">
                    <span className="block truncate">{a.label}</span>
                    <span className="text-xs text-[var(--mut)]">{fmtDate(a.ts)}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <b className="block tabular-nums">{a.amount < 0 ? `−${sgd(-a.amount)}` : `+${sgd(a.amount)}`}</b>
                    <span
                      className={`text-xs ${a.tone === "good" ? "text-[var(--idle)]" : a.tone === "pend" ? "text-[var(--amber)]" : "text-[var(--mut)]"}`}
                    >
                      {a.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {activity.length > 8 && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-2 text-xs text-[var(--mut)] hover:text-[var(--ink)]">
              {showAll ? "Show less" : `Show all ${activity.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, dot }: { label: string; value: number; hint: string; dot?: string }) {
  return (
    <div>
      <span className="flex items-center gap-1.5 text-xs text-[var(--mut)]">
        {dot && <i className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        {label}
      </span>
      <b className="block text-lg tabular-nums">
        <AnimatedNumber value={value} decimals={2} prefix="S$" />
      </b>
      <span className="text-[11px] text-[var(--mut)]">{hint}</span>
    </div>
  );
}
