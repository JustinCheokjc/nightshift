// Nightshift market model, run in the browser. Ported from sandbox/marketplace.py.
// Simulated customers place compute orders; Nightshift splits them into tasks,
// runs them on idle devices, checks a share of results, bills customers and
// pays contributors. No real money moves. The viewer's own enrolled devices
// can join, driven by their real idle status.

export type Kind = "cpu" | "gpu";
export type DeviceClass = "laptop" | "desktop" | "gaming";
type DeviceKind = "sim" | "live";
type DevState = "idle" | "in_use" | "asleep";

export const CPU_TASK_HOURS = 1; // one CPU task = 1 core-hour
export const GPU_TASK_HOURS = 0.25; // one GPU task = 15 GPU-minutes
const SERIES_EVERY_MIN = 15;
const START_MIN = 18 * 60; // start at 6pm on day 1
export const IMAGE = 256;
const TILE = 64;
const TILES_SIDE = IMAGE / TILE;
const TILES = TILES_SIDE * TILES_SIDE;
export const MAX_ITER = 255;

export const CLASSES: Record<DeviceClass, { label: string; cores: number; watts: number; gpu: boolean; profile: string }> = {
  laptop: { label: "Laptop", cores: 8, watts: 15, gpu: false, profile: "student" },
  desktop: { label: "Office desktop", cores: 12, watts: 45, gpu: false, profile: "office" },
  gaming: { label: "Gaming PC", cores: 16, watts: 230, gpu: true, profile: "gamer" },
};
const AREAS = ["Clementi", "Punggol", "Jurong West", "Bedok", "Tampines", "Woodlands", "Serangoon", "Toa Payoh",
  "Ang Mo Kio", "Bishan", "Yishun", "Queenstown", "Hougang", "Sengkang", "Pasir Ris", "Bukit Batok"];
const OFFICES = ["Raffles Place", "one-north", "Tanjong Pagar", "Paya Lebar", "Changi Business Park", "Jurong East"];

export type Config = {
  take_rate: number; electricity: number; cpu_price: number; gpu_price: number; surge_max: number;
  verify_share: number; verify_first_n: number; late_refund: number; demand: number; cheater_share: number;
  fleet: Record<DeviceClass, number>; live_fleet: boolean;
};
export const DEFAULTS: Config = {
  take_rate: 0.3, electricity: 0.3, cpu_price: 0.02, gpu_price: 0.35, surge_max: 2,
  verify_share: 0.05, verify_first_n: 2, late_refund: 0.25, demand: 1, cheater_share: 0.05,
  fleet: { laptop: 4, desktop: 3, gaming: 3 }, live_fleet: true,
};
export const LIMITS: Partial<Record<keyof Config, [number, number]>> = {
  take_rate: [0, 0.9], electricity: [0, 2], cpu_price: [0.001, 1], gpu_price: [0.01, 5], surge_max: [1, 5],
  verify_share: [0, 1], verify_first_n: [0, 20], late_refund: [0, 1], demand: [0.1, 5], cheater_share: [0, 0.5],
};

export const SCENARIOS: Record<string, { label: string } & Partial<Config>> = {
  pilot: { label: "Pilot (10 devices)", fleet: { laptop: 4, desktop: 3, gaming: 3 } },
  launch: { label: "Singapore launch (200)", fleet: { laptop: 120, desktop: 50, gaming: 30 } },
  gamers: { label: "Recruit gaming PCs (200)", fleet: { laptop: 80, desktop: 40, gaming: 80 } },
  premium: { label: "Premium GPU pricing", gpu_price: 0.5, surge_max: 2.5 },
  lean: { label: "Lean verification (1%)", verify_share: 0.01, verify_first_n: 0 },
  city: { label: "City scale (1,000)", fleet: { laptop: 600, desktop: 250, gaming: 150 } },
};

export type BuyerProfile = {
  name: string; segment: string; kind: Kind; what: string; note: string; premium: number;
  size: [number, number]; rate: number; hours: [number, number][]; off_peak: number;
  deadline_h: number; max_surge: number | null; patience: number;
};
// Simulated customers. rate = orders per simulated hour per 10 devices in busy hours.
export const BUYERS: BuyerProfile[] = [
  { name: "Pixelforge Studio", segment: "Animation studio", kind: "cpu", what: "Animation render frames",
    note: "Renders the day's shots before the evening review.", premium: 1, size: [4, 16], rate: 0.8,
    hours: [[9, 19]], off_peak: 0.4, deadline_h: 6, max_surge: null, patience: 0.12 },
  { name: "Orbit Mobile Games", segment: "Game developer", kind: "cpu", what: "Build and test runs",
    note: "Developers wait on these builds, so it pays extra for speed.", premium: 1.2, size: [2, 6], rate: 1.5,
    hours: [[10, 19]], off_peak: 0.1, deadline_h: 2, max_surge: null, patience: 0.15 },
  { name: "Lumen Bio Lab", segment: "University research lab", kind: "cpu", what: "Protein simulations",
    note: "Steady, patient demand. Cares about price, not speed.", premium: 0.8, size: [8, 32], rate: 0.4,
    hours: [[0, 24]], off_peak: 1, deadline_h: 12, max_surge: null, patience: 0.06 },
  { name: "Kopi Analytics", segment: "Data consultancy", kind: "cpu", what: "Overnight data pipelines",
    note: "Runs client reports overnight so they're ready by 9am.", premium: 0.9, size: [6, 24], rate: 0.8,
    hours: [[22, 6]], off_peak: 0.2, deadline_h: 10, max_surge: null, patience: 0.1 },
  { name: "Merlion Weather Co", segment: "Weather forecasting", kind: "cpu", what: "Forecast ensemble runs",
    note: "Large bursts twice a day, when new weather data lands.", premium: 0.75, size: [40, 120], rate: 0.12,
    hours: [[0, 4], [12, 14]], off_peak: 0, deadline_h: 6, max_surge: null, patience: 0.1 },
  { name: "Harbour Freight", segment: "Logistics", kind: "cpu", what: "Delivery route planning",
    note: "Plans the day's delivery routes before the trucks leave at 7am.", premium: 1, size: [10, 30], rate: 0.5,
    hours: [[4, 7]], off_peak: 0.05, deadline_h: 3, max_surge: null, patience: 0.15 },
  { name: "TinyLLM Labs", segment: "AI startup", kind: "gpu", what: "AI inference batches",
    note: "Price-sensitive. Moves work to the cloud if GPU prices surge.", premium: 1, size: [1, 4], rate: 0.3,
    hours: [[9, 23]], off_peak: 0.5, deadline_h: 6, max_surge: 1.6, patience: 0.12 },
  { name: "Kampung Pictures", segment: "Indie film studio", kind: "gpu", what: "GPU video rendering",
    note: "Sends finished edits in the evening for overnight rendering.", premium: 0.9, size: [2, 6], rate: 0.12,
    hours: [[18, 24]], off_peak: 0.3, deadline_h: 12, max_surge: 2, patience: 0.08 },
  { name: "Shophouse AI", segment: "AI agency", kind: "gpu", what: "Model fine-tuning",
    note: "Big, flexible jobs. Only buys when GPUs are cheap.", premium: 0.85, size: [6, 16], rate: 0.04,
    hours: [[0, 24]], off_peak: 1, deadline_h: 24, max_surge: 1.3, patience: 0.05 },
  { name: "Tutorly", segment: "Education platform", kind: "gpu", what: "Lecture transcription",
    note: "Transcribes lectures in school hours; needs them back the same afternoon.", premium: 1.1, size: [1, 2],
    rate: 0.25, hours: [[8, 17]], off_peak: 0.1, deadline_h: 3, max_surge: 2.5, patience: 0.15 },
];

const REGIONS: [number, number, number][] = [
  [-0.5, 0, 3], [-0.7436, 0.1318, 0.012], [-0.1011, 0.9563, 0.025], [-1.2507, 0.0201, 0.004],
  [0.285, 0.01, 0.02], [-0.77, 0.11, 0.06], [-1.749, 0, 0.03], [0.36, -0.64, 0.1],
];

export type Buyer = BuyerProfile & {
  manual: boolean; orders: number; spent: number; refunds: number; delivered: number; late: number;
  satisfaction: number; status: "active" | "left"; declined: number; lost: number; enabled: boolean; left_at?: number;
};
type Task = { id: string; order: string; kind: Kind; hours: number; tile: number; state: "queued" | "running" | "done"; device: string | null };
export type Order = {
  id: string; buyer: string; kind: Kind; what: string; hours: number; unit_price: number; surge: number; price: number;
  created: number; deadline: number; delivered_at: number | null; tasks: string[]; done: number;
  status: "running" | "delivered" | "late"; refund: number; version: number; manual: boolean;
  view?: [number, number, number]; image?: Uint8Array; drawn?: Set<number>;
};
type Device = {
  id: string; name: string; cls: DeviceClass; label: string; profile: string; cores: number; watts: number; gpu: boolean;
  kind: DeviceKind; live_id?: string; cheater: boolean; suspended: boolean; state: DevState; task: string | null;
  finish_at: number | null; done: number; preempted: number; checked: number; passed: number; earned: number;
  gross: number; fees: number; kwh: number; hours: number; joined: number;
};
export type LiveRow = { id: string; name: string; cores: number | null; gpu_model: string | null; status: string; agent_version: string | null };
export type MarketEvent = { t: string; msg: string; kind: "info" | "order" | "good" | "warn" | "bad" };

export function fmtTime(min: number) {
  const m = Math.floor(((min % 1440) + 1440) % 1440);
  return `Day ${Math.floor(min / 1440) + 1}, ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function profileWeights(profile: string, h: number): [number, number, number] {
  if (profile === "student") return h >= 1 && h < 8 ? [0.35, 0.05, 0.6] : h >= 8 && h < 17 ? [0.35, 0.35, 0.3] : [0.2, 0.7, 0.1];
  if (profile === "office") return h >= 9 && h < 18 ? [0.15, 0.8, 0.05] : [0.85, 0.02, 0.13];
  if (h >= 19 || h < 1) return [0.1, 0.85, 0.05];
  return h >= 1 && h < 9 ? [0.75, 0.02, 0.23] : [0.6, 0.25, 0.15];
}

function busyFactor(b: BuyerProfile, hour: number) {
  for (const [s, e] of b.hours) if (s < e ? hour >= s && hour < e : hour >= s || hour < e) return 1;
  return b.off_peak;
}

function poisson(lam: number) {
  if (lam <= 0) return 0;
  let n = 0, p = 1;
  const limit = Math.exp(-lam);
  for (;;) { p *= Math.random(); if (p <= limit) return n; n++; }
}

const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function renderTile(cx: number, cy: number, scale: number, tx: number, ty: number) {
  const out = new Uint8Array(TILE * TILE);
  const half = IMAGE / 2;
  for (let py = 0; py < TILE; py++) {
    const y0 = cy + (ty * TILE + py - half) * scale;
    for (let px = 0; px < TILE; px++) {
      const x0 = cx + (tx * TILE + px - half) * scale;
      let x = 0, y = 0, i = 0;
      while (x * x + y * y <= 4 && i < MAX_ITER) { const nx = x * x - y * y + x0; y = 2 * x * y + y0; x = nx; i++; }
      out[py * TILE + px] = i;
    }
  }
  return out;
}

export class Market {
  cfg: Config = clone(DEFAULTS);
  scenario = "pilot";
  simMinPerSec = 2;
  paused = false;
  now = START_MIN;
  private seq = 0;
  orders = new Map<string, Order>();
  private tasks = new Map<string, Task>();
  private queue: Record<Kind, string[]> = { cpu: [], gpu: [] };
  events: MarketEvent[] = [];
  series: Record<string, number | string>[] = [];
  private nextSeries = START_MIN;
  money = { revenue: 0, fees: 0, payouts: 0, refunds: 0, verify_cost: 0, electricity: 0, cpu_hours: 0, gpu_hours: 0, lost_hours: 0 };
  trust = { results: 0, checks: 0, caught: 0, undetected: 0, passed: 0 };
  buyers = new Map<string, Buyer>();
  devices = new Map<string, Device>();
  private liveRows: LiveRow[] = [];

  constructor() { this.reset(); }

  setPaused(paused: boolean) { this.paused = paused; }
  setSpeed(simMinPerSec: number) { this.simMinPerSec = Math.min(Math.max(simMinPerSec, 0.25), 60); }

  reset() {
    this.now = START_MIN; this.paused = false; this.seq = 0;
    this.orders.clear(); this.tasks.clear(); this.queue = { cpu: [], gpu: [] };
    this.events = []; this.series = []; this.nextSeries = START_MIN;
    for (const k of Object.keys(this.money) as (keyof typeof this.money)[]) this.money[k] = 0;
    for (const k of Object.keys(this.trust) as (keyof typeof this.trust)[]) this.trust[k] = 0;
    const enabled = new Map([...this.buyers.values()].map((b) => [b.name, b.enabled]));
    this.buyers.clear();
    for (const b of BUYERS) this.addBuyer(b, false, enabled.get(b.name) ?? true);
    this.devices.clear();
    this.buildFleet();
    if (this.cfg.live_fleet) this.setLive(this.liveRows);
    this.log(`Market started: ${this.fleetSize()} simulated devices, ${BUYERS.length} customers.`);
  }

  private addBuyer(b: BuyerProfile, manual: boolean, enabled = true) {
    this.buyers.set(b.name, { ...b, manual, orders: 0, spent: 0, refunds: 0, delivered: 0, late: 0, satisfaction: 1,
      status: "active", declined: 0, lost: 0, enabled });
  }
  private id(p: string) { this.seq += 1; return `${p}${this.seq}`; }
  fleetSize() { let n = 0; for (const d of this.devices.values()) if (d.kind === "sim") n++; return n; }
  private hour() { return Math.floor((((this.now % 1440) + 1440) % 1440) / 60); }

  private newDevice(name: string, cls: DeviceClass, kind: DeviceKind, cores?: number): Device {
    const c = CLASSES[cls];
    const d: Device = { id: this.id("d"), name, cls, label: c.label, profile: c.profile, cores: cores || c.cores, watts: c.watts,
      gpu: c.gpu, kind, cheater: false, suspended: false, state: "idle", task: null, finish_at: null, done: 0, preempted: 0,
      checked: 0, passed: 0, earned: 0, gross: 0, fees: 0, kwh: 0, hours: 0, joined: this.now };
    this.devices.set(d.id, d);
    return d;
  }

  private sample(profile: string): DevState {
    const [a, b] = profileWeights(profile, this.hour());
    const r = Math.random();
    return r < a ? "idle" : r < a + b ? "in_use" : "asleep";
  }

  private buildFleet() {
    for (const d of [...this.devices.values()]) if (d.kind === "sim") { this.release(d); this.devices.delete(d.id); }
    const made: Device[] = [];
    for (const cls of ["laptop", "desktop", "gaming"] as DeviceClass[]) {
      const places = cls === "desktop" ? OFFICES : AREAS;
      for (let i = 0; i < (this.cfg.fleet[cls] || 0); i++) {
        const n = Math.floor(i / places.length) + 1;
        const d = this.newDevice(`${CLASSES[cls].label} · ${places[i % places.length]}${n === 1 ? "" : ` ${n}`}`, cls, "sim");
        d.state = this.sample(d.profile);
        made.push(d);
      }
    }
    const total = made.length;
    const cheaters = total < 10 ? 0 : Math.max(1, Math.round(total * this.cfg.cheater_share));
    const pool = made.filter((d) => !d.gpu);
    for (let i = 0; i < Math.min(cheaters, pool.length); i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
      pool[i].cheater = true;
    }
  }

  log(msg: string, kind: MarketEvent["kind"] = "info") {
    this.events.push({ t: fmtTime(this.now), msg, kind });
    if (this.events.length > 80) this.events.splice(0, this.events.length - 80);
  }

  // ------------------------------------------------------------ config
  applyConfig(values: Partial<Config>) {
    let rebuild = false;
    for (const [k, [lo, hi]] of Object.entries(LIMITS) as [keyof Config, [number, number]][]) {
      const v = values[k];
      if (typeof v === "number" && Number.isFinite(v)) (this.cfg as Record<string, unknown>)[k] = Math.min(Math.max(v, lo), hi);
    }
    if (values.fleet) {
      const f = { ...this.cfg.fleet };
      for (const c of Object.keys(CLASSES) as DeviceClass[]) {
        const v = Math.round(Number(values.fleet[c]));
        if (Number.isFinite(v)) f[c] = Math.min(Math.max(v, 0), 2000);
      }
      if (JSON.stringify(f) !== JSON.stringify(this.cfg.fleet)) { this.cfg.fleet = f; rebuild = true; }
    }
    if ("cheater_share" in values) rebuild = true;
    if ("live_fleet" in values) {
      this.cfg.live_fleet = !!values.live_fleet;
      if (this.cfg.live_fleet) this.setLive(this.liveRows);
      else for (const d of [...this.devices.values()]) if (d.kind === "live") { this.release(d); this.devices.delete(d.id); }
    }
    if (rebuild) { this.buildFleet(); this.log(`Fleet changed to ${this.fleetSize()} simulated devices.`); }
  }

  applyScenario(name: string) {
    const sc = SCENARIOS[name];
    if (!sc) return;
    const { label, ...rest } = sc;
    const values: Partial<Config> = { ...clone(DEFAULTS), live_fleet: this.cfg.live_fleet, ...rest };
    if (!rest.fleet) values.fleet = { ...this.cfg.fleet };
    this.scenario = name;
    this.cfg.fleet = { laptop: -1, desktop: -1, gaming: -1 }; // force a rebuild
    this.applyConfig(values);
    this.log(`Scenario: ${label}.`, "order");
  }

  toggleBuyer(name: string, enabled: boolean) {
    const b = this.buyers.get(name);
    if (!b) return;
    b.enabled = enabled;
    this.log(`${name} ${enabled ? "joined" : "left"} the market (switched by you).`, "order");
  }

  // ------------------------------------------------------------ pricing
  capacity(kind: Kind) {
    let gpu = 0, cpu = 0;
    for (const d of this.devices.values()) {
      if (d.suspended || !(d.state === "idle" || d.task)) continue;
      if (d.gpu) { gpu += 1; cpu += 0.5 * d.cores; } else cpu += d.cores;
    }
    return kind === "gpu" ? gpu : cpu;
  }
  backlog(kind: Kind) { return this.queue[kind].length * (kind === "cpu" ? CPU_TASK_HOURS : GPU_TASK_HOURS); }
  surge() {
    const scarcity = this.backlog("gpu") / Math.max(this.capacity("gpu"), 0.25);
    return Math.round(Math.min(this.cfg.surge_max, Math.max(1, 1 + 0.5 * (scarcity - 1))) * 100) / 100;
  }
  quote(kind: Kind, hours: number, premium = 1) {
    const base = kind === "cpu" ? this.cfg.cpu_price : this.cfg.gpu_price;
    const surge = kind === "gpu" ? this.surge() : 1;
    const unit = Math.round(base * premium * surge * 1e4) / 1e4;
    const rate = this.capacity(kind);
    const eta = rate > 0 ? (this.backlog(kind) + hours) / rate : null;
    return { kind, hours, unit_price: unit, surge, price: Math.round(unit * hours * 1e4) / 1e4, eta_hours: eta };
  }

  // ------------------------------------------------------------- orders
  placeOrder(buyerName: string, hours?: number, deadlineH?: number, kind?: Kind, auto = false): Order | null {
    let b = this.buyers.get(buyerName);
    if (!b) {
      this.addBuyer({ name: buyerName, segment: "Your company", kind: kind ?? "cpu", what: "Custom compute order",
        note: "Orders placed from the buyer portal.", premium: 1, size: [4, 16], rate: 0, hours: [], off_peak: 0,
        deadline_h: 8, max_surge: null, patience: 0.12 }, true);
      b = this.buyers.get(buyerName)!;
    }
    const k = kind ?? b.kind;
    const unitH = k === "cpu" ? CPU_TASK_HOURS : GPU_TASK_HOURS;
    const n = Math.max(1, Math.round((hours ?? randInt(b.size[0], b.size[1])) / unitH));
    const h = n * unitH;
    const q = this.quote(k, h, b.premium);
    if (auto && b.max_surge && q.surge > b.max_surge) {
      b.declined += 1; b.lost += q.price;
      if (this.fleetSize() <= 30 || b.declined % 10 === 1)
        this.log(`${b.name} declined to order: GPU price ×${q.surge} is above its limit of ×${b.max_surge}.`, "warn");
      return null;
    }
    const dl = deadlineH ?? b.deadline_h;
    const o: Order = { id: this.id("o"), buyer: b.name, kind: k, what: b.what, hours: h, unit_price: q.unit_price, surge: q.surge,
      price: q.price, created: this.now, deadline: this.now + dl * 60, delivered_at: null, tasks: [], done: 0, status: "running",
      refund: 0, version: 0, manual: b.manual };
    if (k === "cpu") {
      const [cx, cy, w] = REGIONS[Math.floor(Math.random() * REGIONS.length)];
      o.view = [cx, cy, w / IMAGE]; o.image = new Uint8Array(IMAGE * IMAGE); o.drawn = new Set();
    }
    for (let i = 0; i < n; i++) {
      const t: Task = { id: this.id("t"), order: o.id, kind: k, hours: unitH, tile: i % TILES, state: "queued", device: null };
      this.tasks.set(t.id, t); o.tasks.push(t.id); this.queue[k].push(t.id);
    }
    this.orders.set(o.id, o);
    b.orders += 1;
    const unit = k === "cpu" ? "core-hours" : "GPU-hours";
    this.log(`${b.name} ordered ${h} ${unit} of ${b.what.toLowerCase()} for S$${q.price.toFixed(3)}` +
      `${q.surge > 1 ? `, surge ×${q.surge}` : ""}, due in ${dl}h.`, "order");
    return o;
  }

  // ---------------------------------------------------------- main loop
  tick(dtSec: number) {
    if (this.paused) return;
    const dmin = dtSec * this.simMinPerSec;
    this.now += dmin;
    const hour = this.hour();
    const scale = (Math.max(this.fleetSize(), 1) / 10) * this.cfg.demand;

    for (const b of this.buyers.values()) {
      if (b.status === "left" && this.now - (b.left_at ?? this.now) >= 1440) {
        b.status = "active"; b.satisfaction = 0.6;
        this.log(`${b.name} came back to try Nightshift again.`, "order");
      }
      if (b.manual || b.status !== "active" || !b.enabled) continue;
      const rate = b.rate * busyFactor(b, hour) * scale * Math.max(b.satisfaction, 0.35);
      for (let i = Math.min(5, poisson((rate * dmin) / 60)); i > 0; i--) this.placeOrder(b.name, undefined, undefined, undefined, true);
    }

    const sw = 1 - Math.exp(-dmin / 45);
    for (const d of this.devices.values()) if (d.kind === "sim" && Math.random() < sw) this.setState(d, this.sample(d.profile));
    for (const d of this.devices.values()) {
      if (d.task && d.finish_at !== null && this.now >= d.finish_at) this.complete(this.tasks.get(d.task)!, d);
    }
    this.schedule();
    this.previews();
    if (this.now >= this.nextSeries) { this.recordSeries(); this.nextSeries += SERIES_EVERY_MIN; }
  }

  private quiet(d: Device) { return d.kind === "sim" && this.fleetSize() > 30; }

  private setState(d: Device, state: DevState) {
    if (state === d.state) return;
    d.state = state;
    if (state !== "idle" && d.task) {
      const t = this.tasks.get(d.task)!;
      const total = this.wallHours(t, d) * 60;
      const frac = d.finish_at !== null && total ? Math.max(0, Math.min(1, 1 - (d.finish_at - this.now) / total)) : 0;
      this.money.lost_hours += frac * t.hours;
      d.preempted += 1;
      const why = state === "in_use" ? "owner came back" : "went to sleep";
      this.requeue(t, d);
      if (!this.quiet(d)) this.log(`${d.name} ${why}; task handed to another device.`, "warn");
    }
  }
  private requeue(t: Task, d: Device) {
    t.state = "queued"; t.device = null; this.queue[t.kind].unshift(t.id);
    d.task = null; d.finish_at = null;
  }
  private release(d: Device) {
    if (d.task && this.tasks.has(d.task)) this.requeue(this.tasks.get(d.task)!, d);
    d.task = null; d.finish_at = null;
  }
  private wallHours(t: Task, d: Device) { return t.kind === "cpu" ? t.hours / d.cores : t.hours; }

  private schedule() {
    for (const d of this.devices.values()) {
      if (d.task || d.suspended || d.state !== "idle") continue;
      const kind: Kind = d.gpu && this.queue.gpu.length ? "gpu" : "cpu";
      const tid = this.queue[kind].shift();
      if (!tid) continue;
      const t = this.tasks.get(tid)!;
      t.state = "running"; t.device = d.id;
      d.task = tid; d.finish_at = this.now + this.wallHours(t, d) * 60;
    }
  }

  // ---------------------------------------------- results, trust, money
  private complete(t: Task, d: Device) {
    d.task = null; d.finish_at = null;
    const bad = d.cheater && Math.random() < 0.5;
    const check = d.checked < this.cfg.verify_first_n || Math.random() < this.cfg.verify_share;
    if (check) {
      this.trust.checks += 1; d.checked += 1;
      const o = this.orders.get(t.order);
      if (o) this.money.verify_cost += t.hours * o.unit_price * (1 - this.cfg.take_rate); // rerun on another device
      if (bad) {
        d.suspended = true; this.trust.caught += 1; this.trust.results += 1;
        t.state = "queued"; t.device = null; this.queue[t.kind].unshift(t.id);
        this.log(`Caught a wrong result from ${d.name}. Device suspended and not paid; task rerun.`, "bad");
        return;
      }
      d.passed += 1; this.trust.passed += 1;
    } else if (bad) this.trust.undetected += 1;
    this.accept(t, d);
  }

  private accept(t: Task, d: Device) {
    const o = this.orders.get(t.order);
    if (!o) return;
    this.trust.results += 1;
    const gross = t.hours * o.unit_price;
    const fee = gross * this.cfg.take_rate;
    const payout = gross - fee;
    const wall = this.wallHours(t, d);
    const kwh = (d.watts * wall) / 1000;
    d.done += 1; d.gross += gross; d.fees += fee; d.earned += payout; d.kwh += kwh; d.hours += wall;
    const m = this.money;
    m.revenue += gross; m.fees += fee; m.payouts += payout; m.electricity += kwh * this.cfg.electricity;
    if (t.kind === "cpu") m.cpu_hours += t.hours; else m.gpu_hours += t.hours;
    this.buyers.get(o.buyer)!.spent += gross;
    t.state = "done"; o.done += 1; o.version += 1;
    if (o.done === o.tasks.length) this.deliver(o);
  }

  private deliver(o: Order) {
    const b = this.buyers.get(o.buyer)!;
    o.delivered_at = this.now;
    const late = this.now > o.deadline;
    o.status = late ? "late" : "delivered";
    b.delivered += 1;
    for (const tid of o.tasks) this.tasks.delete(tid);
    if (late) {
      const refund = o.price * this.cfg.late_refund;
      o.refund = refund; b.late += 1; b.refunds += refund; b.spent -= refund; this.money.refunds += refund;
      b.satisfaction = Math.max(0, b.satisfaction - b.patience);
      this.log(`Delivered ${o.buyer}'s order late; refunded S$${refund.toFixed(3)}.`, "warn");
      if (b.satisfaction < 0.35 && b.status === "active" && !b.manual) {
        b.status = "left"; b.left_at = this.now;
        this.log(`${o.buyer} left the platform after repeated late deliveries.`, "bad");
      }
    } else {
      b.satisfaction = Math.min(1, b.satisfaction + 0.03);
      if (this.fleetSize() <= 30 || o.manual) this.log(`Delivered ${o.buyer}'s order on time (S$${o.price.toFixed(3)}).`, "good");
    }
    const done = [...this.orders.values()].filter((x) => x.status !== "running");
    if (done.length > 3000) for (const x of done.sort((a, z) => a.created - z.created).slice(0, done.length - 3000)) this.orders.delete(x.id);
  }

  // ----------------------------------------------------------- previews
  recentOrders(n: number) { return [...this.orders.values()].sort((a, b) => b.created - a.created).slice(0, n); }

  private previews() {
    let budget = 6; // tiles rendered per tick, keeps the page responsive
    for (const o of this.recentOrders(12)) {
      if (o.kind !== "cpu" || !o.image || !o.view || !o.drawn) continue;
      const want = Math.min(TILES, Math.ceil((TILES * o.done) / o.tasks.length));
      for (let tile = 0; tile < TILES && o.drawn.size < want && budget > 0; tile++) {
        if (o.drawn.has(tile)) continue;
        const tx = tile % TILES_SIDE, ty = Math.floor(tile / TILES_SIDE);
        const data = renderTile(o.view[0], o.view[1], o.view[2], tx, ty);
        for (let r = 0; r < TILE; r++) o.image.set(data.subarray(r * TILE, (r + 1) * TILE), (ty * TILE + r) * IMAGE + tx * TILE);
        o.drawn.add(tile); o.version += 1; budget--;
      }
    }
  }

  // ---------------------------------------------------------- live fleet
  setLive(rows: LiveRow[]) {
    this.liveRows = rows;
    if (!this.cfg.live_fleet) return;
    const existing = new Map([...this.devices.values()].filter((d) => d.kind === "live").map((d) => [d.live_id!, d]));
    for (const row of rows) {
      if ((row.agent_version ?? "").endsWith("-demo")) continue; // skip "Load demo data" devices
      let d = existing.get(row.id);
      existing.delete(row.id);
      if (!d) {
        d = this.newDevice(`Your device · ${row.name}`, row.gpu_model ? "gaming" : "laptop", "live", row.cores || 8);
        d.live_id = row.id;
        this.log(`${row.name} joined from your dashboard, using its real idle status.`, "good");
      }
      this.setState(d, row.status === "idle" ? "idle" : row.status === "in_use" || row.status === "online" ? "in_use" : "asleep");
    }
    for (const d of existing.values()) { this.release(d); this.devices.delete(d.id); }
  }

  // ---------------------------------------------------------- reporting
  counts() {
    const c = { working: 0, idle: 0, in_use: 0, asleep: 0, suspended: 0 };
    for (const d of this.devices.values()) c[d.suspended ? "suspended" : d.task ? "working" : d.state] += 1;
    return c;
  }
  private recordSeries() {
    const m = this.money;
    this.series.push({ t: Math.round((this.now - START_MIN) * 10) / 10, label: fmtTime(this.now).replace("Day ", "D").replace(",", ""),
      revenue: m.revenue - m.refunds, profit: m.fees - m.refunds - m.verify_cost, payouts: m.payouts, surge: this.surge(), ...this.counts() });
    if (this.series.length > (7 * 24 * 60) / SERIES_EVERY_MIN) this.series.shift();
  }
  elapsedDays() { return Math.max((this.now - START_MIN) / 1440, 1 / 48); }

  kpis() {
    const m = this.money, days = this.elapsedDays(), n = Math.max(this.devices.size, 1);
    const revenue = m.revenue - m.refunds, profit = m.fees - m.refunds - m.verify_cost;
    return { ...m, revenue, gross: m.revenue, profit, margin: revenue > 0 ? profit / revenue : 0,
      contributor_net: m.payouts - m.electricity, profit_per_month: (profit / days) * 30,
      profit_per_device_month: (profit / days) * 30 / n, backlog_cpu: this.backlog("cpu"), backlog_gpu: this.backlog("gpu"),
      surge: this.surge(), devices: this.devices.size, ...this.counts() };
  }

  deviceRow(d: Device) {
    const days = this.elapsedDays(), elec = d.kwh * this.cfg.electricity;
    const attempts = d.done + d.preempted, completion = attempts ? d.done / attempts : 1;
    const passRate = d.checked ? d.passed / d.checked : 1;
    return { id: d.id, name: d.name, label: d.label, cls: d.cls, kind: d.kind, cores: d.cores, watts: d.watts,
      state: d.suspended ? "suspended" : d.task ? "working" : d.state, done: d.done, preempted: d.preempted,
      checked: d.checked, passed: d.passed, hours: d.hours, gross: d.gross, fees: d.fees, earned: d.earned,
      electricity: elec, net: d.earned - elec, net_per_month: ((d.earned - elec) / days) * 30, joined: fmtTime(d.joined),
      reliability: d.suspended ? 0 : Math.round(100 * passRate * (0.7 + 0.3 * completion)) };
  }
  deviceRows() {
    return [...this.devices.values()].sort((a, b) => (a.kind === "sim" ? 1 : 0) - (b.kind === "sim" ? 1 : 0) || b.earned - a.earned)
      .map((d) => this.deviceRow(d));
  }
  classEconomics() {
    const out: { cls: DeviceClass; label: string; count: number; net_per_month: number; fees_per_month: number }[] = [];
    for (const cls of Object.keys(CLASSES) as DeviceClass[]) {
      const rows = [...this.devices.values()].filter((d) => d.cls === cls && d.kind === "sim").map((d) => this.deviceRow(d));
      if (!rows.length) continue;
      out.push({ cls, label: CLASSES[cls].label, count: rows.length,
        net_per_month: rows.reduce((a, r) => a + r.net_per_month, 0) / rows.length,
        fees_per_month: (rows.reduce((a, r) => a + r.fees, 0) / this.elapsedDays()) * 30 / rows.length });
    }
    return out;
  }
  orderRow(o: Order) {
    return { id: o.id, buyer: o.buyer, kind: o.kind, what: o.what, hours: o.hours, unit_price: o.unit_price, surge: o.surge,
      price: o.price, refund: o.refund, done: o.done, total: o.tasks.length, status: o.status, version: o.version,
      created: fmtTime(o.created), due: fmtTime(o.deadline), delivered: o.delivered_at !== null ? fmtTime(o.delivered_at) : "",
      overdue: o.status === "running" && this.now > o.deadline };
  }
  invoices(buyer?: string) {
    return [...this.orders.values()].sort((a, b) => b.created - a.created).filter((o) => !buyer || o.buyer === buyer).map((o) => this.orderRow(o));
  }
  summary(label: string) {
    return { label: label || SCENARIOS[this.scenario]?.label || this.scenario, saved_at: new Date().toISOString(),
      sim_days: Math.round(this.elapsedDays() * 100) / 100, kpi: this.kpis() };
  }
}
