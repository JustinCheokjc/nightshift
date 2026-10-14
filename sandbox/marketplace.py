"""Nightshift marketplace sandbox.

Fictional buyers place compute orders; Nightshift splits them into tasks,
runs them on idle devices, checks results, bills buyers and pays
contributors. No real money moves and nothing is written to the live
dashboard's database.

  python marketplace.py               then open http://127.0.0.1:8090
  python worker.py --idle-after 20    adds this computer as a real device

Simulated devices follow typical day/night habits and their work is
modelled. Real devices (worker.py) compute real tiles that are checked by
recomputing them. Optionally the sandbox mirrors the live idle state of
devices enrolled on your Nightshift dashboard (read-only).
"""
import base64
import csv
import io
import json
import math
import os
import random
import threading
import time
import urllib.request
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import mandel

HERE = os.path.dirname(os.path.abspath(__file__))
RUNS_DIR = os.path.join(HERE, "runs")
ENV_FILE = os.path.join(HERE, "..", "dashboard", ".env.local")
LOGO_FILE = os.path.join(HERE, "..", "site", "logo-mark.svg")
PORT = int(os.environ.get("SANDBOX_PORT", "8090"))
TICK_SEC = 0.25
LEASE_SEC = 60
CPU_TASK_HOURS = 1.0      # one CPU task = 1 core-hour
GPU_TASK_HOURS = 0.25     # one GPU task = 15 GPU-minutes
SERIES_EVERY_MIN = 15
TILES = mandel.TILES_PER_SIDE ** 2
START_MIN = 18 * 60.0     # simulations start at 6pm on day 1

CLASSES = {
    "laptop":  {"label": "Laptop",         "cores": 8,  "watts": 15,  "gpu": False, "profile": "student"},
    "desktop": {"label": "Office desktop", "cores": 12, "watts": 45,  "gpu": False, "profile": "office"},
    "gaming":  {"label": "Gaming PC",      "cores": 16, "watts": 230, "gpu": True,  "profile": "gamer"},
}
AREAS = ["Clementi", "Punggol", "Jurong West", "Bedok", "Tampines", "Woodlands", "Serangoon", "Toa Payoh",
         "Ang Mo Kio", "Bishan", "Yishun", "Queenstown", "Hougang", "Sengkang", "Pasir Ris", "Bukit Batok"]
OFFICES = ["Raffles Place", "one-north", "Tanjong Pagar", "Paya Lebar", "Changi Business Park", "Jurong East"]

DEFAULTS = {
    "take_rate": 0.30,            # Nightshift's cut of what buyers pay
    "electricity": 0.30,          # S$/kWh paid by contributors
    "cpu_price": 0.020,           # S$ per core-hour (before buyer discounts)
    "gpu_price": 0.35,            # S$ per GPU-hour (before surge)
    "surge_max": 2.0,             # cap on GPU surge pricing
    "verify_share": 0.05,         # share of results rechecked
    "verify_first_n": 2,          # always check a device's first results
    "late_refund": 0.25,          # refund on late orders
    "demand": 1.0,                # buyer demand multiplier
    "cheater_share": 0.05,        # share of simulated devices that return bad results
    "fleet": {"laptop": 4, "desktop": 3, "gaming": 3},
    "live_fleet": False,          # mirror devices enrolled on the live dashboard
}

SCENARIOS = {
    "pilot":    {"label": "Hackathon pilot (10 devices)", "fleet": {"laptop": 4, "desktop": 3, "gaming": 3}},
    "launch":   {"label": "Singapore launch (200 devices)", "fleet": {"laptop": 120, "desktop": 50, "gaming": 30}},
    "gamers":   {"label": "Recruit gaming PCs (200 devices)", "fleet": {"laptop": 80, "desktop": 40, "gaming": 80}},
    "premium":  {"label": "Premium GPU pricing", "gpu_price": 0.50, "surge_max": 2.5},
    "lean":     {"label": "Lean verification (1%)", "verify_share": 0.01, "verify_first_n": 0},
    "city":     {"label": "City scale (1,000 devices)", "fleet": {"laptop": 600, "desktop": 250, "gaming": 150}},
}

# Fictional buyers. Order rates are per simulated hour per 10 devices of fleet.
BUYERS = [
    {"name": "Pixelforge Studio", "kind": "cpu", "what": "Animation render frames", "premium": 1.00,
     "size": (4, 16), "rate_day": 1.0, "rate_night": 0.5, "deadline_h": 6},
    {"name": "Lumen Bio Lab", "kind": "cpu", "what": "Batch simulations", "premium": 0.80,
     "size": (8, 32), "rate_day": 0.5, "rate_night": 0.5, "deadline_h": 12},
    {"name": "Kopi Analytics", "kind": "cpu", "what": "Overnight data pipelines", "premium": 0.90,
     "size": (6, 24), "rate_day": 0.2, "rate_night": 0.9, "deadline_h": 10},
    {"name": "TinyLLM Labs", "kind": "gpu", "what": "AI inference batches", "premium": 1.00,
     "size": (1, 4), "rate_day": 0.35, "rate_night": 0.45, "deadline_h": 6},
]

REGIONS = [
    (-0.5, 0.0, 3.0), (-0.7436, 0.1318, 0.012), (-0.1011, 0.9563, 0.025), (-1.2507, 0.0201, 0.004),
    (0.2850, 0.0100, 0.020), (-0.7700, 0.1100, 0.060), (-1.7490, 0.0000, 0.030), (0.3600, -0.6400, 0.100),
]


def profile_weights(profile, h):
    """(idle, in use, asleep) likelihood by hour of day."""
    if profile == "student":
        if 1 <= h < 8:
            return (0.35, 0.05, 0.60)
        if 8 <= h < 17:
            return (0.35, 0.35, 0.30)
        return (0.20, 0.70, 0.10)
    if profile == "office":
        if 9 <= h < 18:
            return (0.15, 0.80, 0.05)
        return (0.85, 0.02, 0.13)
    if h >= 19 or h < 1:
        return (0.10, 0.85, 0.05)
    if 1 <= h < 9:
        return (0.75, 0.02, 0.23)
    return (0.60, 0.25, 0.15)


def fmt_time(sim_min):
    m = int(sim_min % 1440)
    return f"Day {int(sim_min // 1440) + 1}, {m // 60:02d}:{m % 60:02d}"


def load_env():
    env = {}
    try:
        with open(ENV_FILE, encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.lstrip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    env[k] = v.strip().strip('"')
    except OSError:
        pass
    return env


class Market:
    def __init__(self, pool):
        self.pool = pool
        self.lock = threading.RLock()
        self.cfg = json.loads(json.dumps(DEFAULTS))
        self.scenario = "pilot"
        self.sim_min_per_sec = 2.0
        self.reset()

    # ================================================================ setup
    def reset(self):
        with self.lock:
            self.now = START_MIN
            self.paused = False
            self.seq = 0
            self.orders, self.tasks = {}, {}
            self.queue = {"cpu": [], "gpu": []}
            self.events, self.series = [], []
            self.next_series = START_MIN
            self.inflight = 0
            self.money = dict.fromkeys(("revenue", "fees", "payouts", "refunds", "verify_cost", "electricity",
                                        "cpu_hours", "gpu_hours", "lost_hours"), 0.0)
            self.trust = dict.fromkeys(("results", "checks", "caught", "undetected", "passed"), 0)
            self.buyers = {}
            for b in BUYERS:
                self._add_buyer(b)
            self.devices = {}
            self._build_fleet()
            self.log(f"Sandbox started: {self._fleet_size()} devices, {len(BUYERS)} fictional buyers.")

    def _add_buyer(self, template, manual=False):
        self.buyers[template["name"]] = {**template, "manual": manual, "orders": 0, "spent": 0.0, "refunds": 0.0,
                                         "delivered": 0, "late": 0, "satisfaction": 1.0, "status": "active"}

    def _id(self, prefix):
        self.seq += 1
        return f"{prefix}{self.seq}"

    def _fleet_size(self):
        return sum(1 for d in self.devices.values() if d["kind"] == "sim")

    def _new_device(self, name, cls, kind, cores=None):
        c = CLASSES[cls]
        d = {"id": self._id("d"), "name": name, "cls": cls, "label": c["label"], "profile": c["profile"],
             "cores": cores or c["cores"], "watts": c["watts"], "gpu": c["gpu"], "kind": kind,
             "cheater": False, "suspended": False, "state": "idle", "task": None, "finish_at": None,
             "done": 0, "preempted": 0, "checked": 0, "passed": 0, "earned": 0.0, "gross": 0.0, "fees": 0.0,
             "kwh": 0.0, "hours": 0.0, "last_seen": time.time(), "joined": self.now}
        self.devices[d["id"]] = d
        return d

    def _build_fleet(self):
        for d in [d for d in self.devices.values() if d["kind"] == "sim"]:
            self._release(d)
            del self.devices[d["id"]]
        fleet = self.cfg["fleet"]
        total = sum(fleet.values())
        made = []
        for cls in ("laptop", "desktop", "gaming"):
            for i in range(int(fleet.get(cls, 0))):
                place = OFFICES[i % len(OFFICES)] if cls == "desktop" else AREAS[i % len(AREAS)]
                n = i // (len(OFFICES) if cls == "desktop" else len(AREAS)) + 1
                d = self._new_device(f"{CLASSES[cls]['label']} · {place}{'' if n == 1 else f' {n}'}", cls, "sim")
                d["state"] = self._sample_state(d["profile"])
                made.append(d)
        cheaters = 0 if total < 10 else max(1, round(total * self.cfg["cheater_share"]))
        for d in random.sample([d for d in made if not d["gpu"]] or made, min(cheaters, len(made))):
            d["cheater"] = True

    def _sample_state(self, profile):
        w = profile_weights(profile, int(self.now % 1440) // 60)
        return random.choices(("idle", "in_use", "asleep"), weights=w)[0]

    def log(self, msg, kind="info"):
        self.events.append({"t": fmt_time(self.now), "msg": msg, "kind": kind})
        del self.events[:-80]

    # ============================================================== config
    def apply_config(self, values):
        rebuild = False
        limits = {"take_rate": (0, 0.9), "electricity": (0, 2), "cpu_price": (0.001, 1), "gpu_price": (0.01, 5),
                  "surge_max": (1, 5), "verify_share": (0, 1), "verify_first_n": (0, 20), "late_refund": (0, 1),
                  "demand": (0.1, 5), "cheater_share": (0, 0.5)}
        for k, (lo, hi) in limits.items():
            if k in values:
                try:
                    self.cfg[k] = min(max(float(values[k]), lo), hi)
                except (TypeError, ValueError):
                    pass
        if "fleet" in values:
            fleet = {}
            for cls in CLASSES:
                current = self.cfg["fleet"].get(cls, DEFAULTS["fleet"][cls])
                try:
                    fleet[cls] = min(max(int(values["fleet"].get(cls, current)), 0), 2000)
                except (TypeError, ValueError, AttributeError):
                    fleet[cls] = current
            if fleet != self.cfg["fleet"]:
                self.cfg["fleet"] = fleet
                rebuild = True
        if "cheater_share" in values:
            rebuild = True
        if "live_fleet" in values:
            self.cfg["live_fleet"] = bool(values["live_fleet"])
            if not self.cfg["live_fleet"]:
                for d in [d for d in self.devices.values() if d["kind"] == "live"]:
                    self._release(d)
                    del self.devices[d["id"]]
        if rebuild:
            self._build_fleet()
            self.log(f"Fleet changed to {self._fleet_size()} simulated devices.")

    def apply_scenario(self, name):
        if name not in SCENARIOS:
            return
        base = json.loads(json.dumps(DEFAULTS))
        base["live_fleet"] = self.cfg["live_fleet"]
        values = {**base, **{k: v for k, v in SCENARIOS[name].items() if k != "label"}}
        if "fleet" not in SCENARIOS[name]:
            values["fleet"] = self.cfg["fleet"]
        self.scenario = name
        self.cfg["fleet"] = {}  # force rebuild
        self.apply_config(values)
        self.log(f"Scenario: {SCENARIOS[name]['label']}.", "order")

    # ============================================================== pricing
    def capacity(self, kind):
        """Hours of work per hour the fleet can do right now (idle or working devices)."""
        avail = [d for d in self.devices.values() if (d["state"] == "idle" or d["task"]) and not d["suspended"]]
        if kind == "gpu":
            return sum(1 for d in avail if d["gpu"])
        return sum(d["cores"] for d in avail if not d["gpu"]) + 0.5 * sum(d["cores"] for d in avail if d["gpu"])

    def backlog(self, kind):
        return len(self.queue[kind]) * (CPU_TASK_HOURS if kind == "cpu" else GPU_TASK_HOURS)

    def surge(self):
        scarcity = self.backlog("gpu") / max(self.capacity("gpu"), 0.25)
        return round(min(self.cfg["surge_max"], max(1.0, 1 + 0.5 * (scarcity - 1))), 2)

    def quote(self, kind, hours, premium=1.0):
        base = self.cfg["cpu_price"] if kind == "cpu" else self.cfg["gpu_price"]
        surge = self.surge() if kind == "gpu" else 1.0
        unit = round(base * premium * surge, 4)
        rate = self.capacity(kind)
        eta = (self.backlog(kind) + hours) / rate if rate > 0 else None
        return {"kind": kind, "hours": hours, "unit_price": unit, "surge": surge, "price": round(unit * hours, 4),
                "eta_hours": None if eta is None else round(eta, 2), "capacity": rate}

    # =============================================================== orders
    def place_order(self, buyer_name, hours=None, deadline_h=None, kind=None):
        b = self.buyers.get(buyer_name)
        if not b:
            b = {"name": buyer_name, "kind": kind or "cpu", "what": "Custom compute order", "premium": 1.0,
                 "size": (4, 16), "rate_day": 0, "rate_night": 0, "deadline_h": 8}
            self._add_buyer(b, manual=True)
            b = self.buyers[buyer_name]
        kind = kind or b["kind"]
        unit_h = CPU_TASK_HOURS if kind == "cpu" else GPU_TASK_HOURS
        if hours is None:
            hours = random.randint(*b["size"])
        n = max(1, int(round(hours / unit_h)))
        hours = n * unit_h
        q = self.quote(kind, hours, b["premium"])
        deadline_h = deadline_h or b["deadline_h"]
        o = {"id": self._id("o"), "buyer": b["name"], "kind": kind, "what": b["what"], "hours": hours,
             "unit_price": q["unit_price"], "surge": q["surge"], "price": q["price"], "created": self.now,
             "deadline": self.now + deadline_h * 60, "delivered_at": None, "tasks": [], "done": 0,
             "status": "running", "refund": 0.0, "version": 0, "manual": b["manual"]}
        if kind == "cpu":
            cx, cy, width = random.choice(REGIONS)
            o["view"] = (cx, cy, width / mandel.IMAGE)
            o["image"] = bytearray(mandel.IMAGE * mandel.IMAGE)
            o["tiles_drawn"] = set()
            o["tiles_pending"] = set()
        for i in range(n):
            t = {"id": self._id("t"), "order": o["id"], "kind": kind, "hours": unit_h, "tile": i % TILES,
                 "state": "queued", "device": None, "attempts": 0}
            self.tasks[t["id"]] = t
            o["tasks"].append(t["id"])
            self.queue[kind].append(t["id"])
        self.orders[o["id"]] = o
        b["orders"] += 1
        unit = "core-hours" if kind == "cpu" else "GPU-hours"
        surge = f", surge ×{q['surge']}" if q["surge"] > 1 else ""
        self.log(f"{b['name']} ordered {hours:g} {unit} of {b['what'].lower()} for S${q['price']:.3f}"
                 f"{surge}, due in {deadline_h:g}h.", "order")
        return o

    # ============================================================ main loop
    def tick(self, dt):
        with self.lock:
            if self.paused:
                return
            dmin = dt * self.sim_min_per_sec
            self.now += dmin
            hour = int(self.now % 1440) // 60
            night = hour >= 22 or hour < 7
            scale = max(self._fleet_size(), 1) / 10 * self.cfg["demand"]

            for b in self.buyers.values():
                if b["status"] == "left" and self.now - b.get("left_at", self.now) >= 1440:
                    b.update(status="active", satisfaction=0.6)
                    self.log(f"{b['name']} came back to try Nightshift again.", "order")
                if b["manual"] or b["status"] != "active":
                    continue
                rate = (b["rate_night"] if night else b["rate_day"]) * scale * max(b["satisfaction"], 0.35)
                expected = rate * dmin / 60
                for _ in range(min(5, self._poisson(expected))):
                    self.place_order(b["name"])

            switch = 1 - math.exp(-dmin / 45)
            for d in self.devices.values():
                if d["kind"] == "real":
                    if time.time() - d["last_seen"] > 20 and d["state"] != "offline":
                        self._set_state(d, "offline")
                elif d["kind"] == "sim" and random.random() < switch:
                    self._set_state(d, self._sample_state(d["profile"]))

            for d in self.devices.values():
                t = self.tasks.get(d["task"]) if d["task"] else None
                if not t:
                    continue
                if d["kind"] == "real":
                    if time.time() > d["finish_at"]:
                        self._requeue(t, d, f"{d['name']} stopped responding; task moved.")
                elif self.now >= d["finish_at"]:
                    self._complete_modelled(t, d)

            self._schedule()
            self._previews()
            if self.now >= self.next_series:
                self._record_series()
                self.next_series += SERIES_EVERY_MIN

    @staticmethod
    def _poisson(lam):
        if lam <= 0:
            return 0
        n, p, limit = 0, 1.0, math.exp(-lam)
        while True:
            p *= random.random()
            if p <= limit:
                return n
            n += 1

    def _quiet(self, d):
        return d["kind"] == "sim" and self._fleet_size() > 30  # keep the activity log readable at scale

    def _set_state(self, d, state):
        if state == d["state"]:
            return
        d["state"] = state
        finished = d["kind"] != "real" and d["finish_at"] is not None and self.now >= d["finish_at"]
        if state != "idle" and d["task"] and not finished:
            why = {"in_use": "owner came back", "asleep": "went to sleep", "offline": "went offline",
                   "battery": "was unplugged"}.get(state, state)
            self._requeue(self.tasks[d["task"]], d, f"{d['name']} {why}; task handed to another device.", lost=True)

    def _requeue(self, t, d, msg, lost=False):
        if lost and d["kind"] != "real" and d["finish_at"]:
            total = self._wall_hours(t, d) * 60
            frac = max(0.0, min(1.0, 1 - (d["finish_at"] - self.now) / total)) if total else 0
            self.money["lost_hours"] += frac * t["hours"]
        d["preempted"] += 1
        t.update(state="queued", device=None)
        t["attempts"] += 1
        self.queue[t["kind"]].insert(0, t["id"])
        d.update(task=None, finish_at=None)
        if not self._quiet(d):
            self.log(msg, "warn")

    def _release(self, d):
        if d["task"] and d["task"] in self.tasks:
            t = self.tasks[d["task"]]
            t.update(state="queued", device=None)
            self.queue[t["kind"]].insert(0, t["id"])
        d.update(task=None, finish_at=None)

    def _wall_hours(self, t, d):
        return t["hours"] / d["cores"] if t["kind"] == "cpu" else t["hours"]

    def _schedule(self):
        waiting_real = sum(1 for d in self.devices.values()
                           if d["kind"] == "real" and d["state"] == "idle" and not d["task"] and not d["suspended"])
        reserve = 2 * waiting_real
        for d in self.devices.values():
            if d["kind"] == "real" or d["task"] or d["suspended"] or d["state"] != "idle":
                continue
            kind = "gpu" if d["gpu"] and self.queue["gpu"] else "cpu"
            q = self.queue[kind]
            if kind == "cpu" and len(q) <= reserve:
                continue
            if not q:
                continue
            tid = q.pop(reserve if kind == "cpu" else 0)
            t = self.tasks[tid]
            t.update(state="running", device=d["id"])
            d["task"] = tid
            d["finish_at"] = self.now + self._wall_hours(t, d) * 60

    def lease_to_real(self, d):
        if d["task"] or d["suspended"] or d["state"] != "idle" or not self.queue["cpu"]:
            return None
        tid = self.queue["cpu"].pop(0)
        t = self.tasks[tid]
        o = self.orders[t["order"]]
        t.update(state="running", device=d["id"])
        d["task"], d["finish_at"] = tid, time.time() + LEASE_SEC
        return {"task_id": tid, "view": o["view"], "tx": t["tile"] % mandel.TILES_PER_SIDE,
                "ty": t["tile"] // mandel.TILES_PER_SIDE, "buyer": o["buyer"]}

    # ================================================= results, trust, money
    def _must_check(self, d):
        return d["checked"] < self.cfg["verify_first_n"] or random.random() < self.cfg["verify_share"]

    def _complete_modelled(self, t, d):
        d.update(task=None, finish_at=None)
        bad = d["cheater"] and random.random() < 0.5
        if self._must_check(d):
            self._charge_check(t)
            d["checked"] += 1
            if bad:
                return self._caught(t, d)
            d["passed"] += 1
            self.trust["passed"] += 1
        elif bad:
            self.trust["undetected"] += 1
        self._accept(t, d)

    def _charge_check(self, t):
        # A check reruns the task on another contributor's idle device, paid at the contributor rate.
        self.trust["checks"] += 1
        o = self.orders.get(t["order"])
        if o:
            self.money["verify_cost"] += t["hours"] * o["unit_price"] * (1 - self.cfg["take_rate"])

    def _caught(self, t, d):
        d["suspended"] = True
        self.trust["caught"] += 1
        self.trust["results"] += 1
        t.update(state="queued", device=None)
        t["attempts"] += 1
        self.queue[t["kind"]].insert(0, t["id"])
        self.log(f"Caught a wrong result from {d['name']}. Device suspended and not paid; task rerun.", "bad")

    def real_result(self, d, task_id, data):
        t = self.tasks.get(task_id)
        if not t or t["device"] != d["id"] or t["state"] != "running":
            return False
        d.update(task=None, finish_at=None)
        o = self.orders[t["order"]]
        tx, ty = t["tile"] % mandel.TILES_PER_SIDE, t["tile"] // mandel.TILES_PER_SIDE
        if self._must_check(d):
            self._charge_check(t)
            d["checked"] += 1
            t["state"] = "verifying"
            fut = self.pool.submit(mandel.render_tile, *o["view"], tx, ty)

            def done(f, t=t, d=d, data=data, o=o):
                with self.lock:
                    if f.result() == data:
                        d["passed"] += 1
                        self.trust["passed"] += 1
                        self._paint(o, t["tile"], data)
                        self._accept(t, d)
                    else:
                        self._caught(t, d)
            fut.add_done_callback(done)
        else:
            self._paint(o, t["tile"], data)
            self._accept(t, d)
        return True

    def _accept(self, t, d):
        o = self.orders.get(t["order"])
        if not o:
            return
        self.trust["results"] += 1
        gross = t["hours"] * o["unit_price"]
        fee = gross * self.cfg["take_rate"]
        payout = gross - fee
        wall = self._wall_hours(t, d)
        kwh = d["watts"] * wall / 1000
        d["done"] += 1
        d["gross"] += gross
        d["fees"] += fee
        d["earned"] += payout
        d["kwh"] += kwh
        d["hours"] += wall
        m = self.money
        m["revenue"] += gross
        m["fees"] += fee
        m["payouts"] += payout
        m["electricity"] += kwh * self.cfg["electricity"]
        m["cpu_hours" if t["kind"] == "cpu" else "gpu_hours"] += t["hours"]
        self.buyers[o["buyer"]]["spent"] += gross
        t["state"] = "done"
        o["done"] += 1
        o["version"] += 1
        if o["done"] == len(o["tasks"]):
            self._deliver(o)

    def _deliver(self, o):
        b = self.buyers[o["buyer"]]
        o["delivered_at"] = self.now
        late = self.now > o["deadline"]
        o["status"] = "late" if late else "delivered"
        b["delivered"] += 1
        for tid in o["tasks"]:
            self.tasks.pop(tid, None)
        if late:
            refund = o["price"] * self.cfg["late_refund"]
            o["refund"] = refund
            b["late"] += 1
            b["refunds"] += refund
            b["spent"] -= refund
            self.money["refunds"] += refund
            b["satisfaction"] = max(0.0, b["satisfaction"] - 0.12)
            if not b["manual"] or b["delivered"] < 50:
                self.log(f"Delivered {o['buyer']}'s order late; refunded S${refund:.3f}.", "warn")
            if b["satisfaction"] < 0.35 and b["status"] == "active" and not b["manual"]:
                b["status"] = "left"
                b["left_at"] = self.now
                self.log(f"{o['buyer']} left the platform after repeated late deliveries.", "bad")
        else:
            b["satisfaction"] = min(1.0, b["satisfaction"] + 0.03)
            if self._fleet_size() <= 30 or o["manual"]:
                self.log(f"Delivered {o['buyer']}'s order on time (S${o['price']:.3f}).", "good")
        self._prune_orders()

    def _prune_orders(self):
        done = [o for o in self.orders.values() if o["status"] != "running"]
        if len(done) > 3000:
            for o in sorted(done, key=lambda o: o["created"])[:len(done) - 3000]:
                del self.orders[o["id"]]

    # ============================================================ previews
    def _paint(self, o, tile, data):
        if tile in o.get("tiles_drawn", ()):
            return
        s, tx, ty = mandel.SIZE, tile % mandel.TILES_PER_SIDE, tile // mandel.TILES_PER_SIDE
        for row in range(s):
            start = (ty * s + row) * mandel.IMAGE + tx * s
            o["image"][start:start + s] = data[row * s:(row + 1) * s]
        o["tiles_drawn"].add(tile)
        o["version"] += 1

    def _previews(self):
        """Render real preview tiles in proportion to progress, for the orders on screen only."""
        shown = [o for o in self.recent_orders(12) if o["kind"] == "cpu"]
        for o in shown:
            want = min(TILES, math.ceil(TILES * o["done"] / len(o["tasks"])))
            for tile in range(TILES):
                if len(o["tiles_drawn"]) + len(o["tiles_pending"]) >= want or self.inflight >= 8:
                    break
                if tile in o["tiles_drawn"] or tile in o["tiles_pending"]:
                    continue
                o["tiles_pending"].add(tile)
                self.inflight += 1
                tx, ty = tile % mandel.TILES_PER_SIDE, tile // mandel.TILES_PER_SIDE
                fut = self.pool.submit(mandel.render_tile, *o["view"], tx, ty)

                def done(f, o=o, tile=tile):
                    with self.lock:
                        self.inflight -= 1
                        o["tiles_pending"].discard(tile)
                        self._paint(o, tile, f.result())
                fut.add_done_callback(done)

    def recent_orders(self, n):
        return sorted(self.orders.values(), key=lambda o: o["created"], reverse=True)[:n]

    # =========================================================== reporting
    def _counts(self):
        c = {"working": 0, "idle": 0, "in_use": 0, "asleep": 0, "suspended": 0}
        for d in self.devices.values():
            key = "suspended" if d["suspended"] else "working" if d["task"] else d["state"]
            key = key if key in c else "asleep"
            c[key] += 1
        return c

    def _record_series(self):
        m = self.money
        self.series.append({"t": round(self.now - START_MIN, 1), "label": fmt_time(self.now),
                            "revenue": round(m["revenue"] - m["refunds"], 4),
                            "profit": round(m["fees"] - m["refunds"] - m["verify_cost"], 4),
                            "payouts": round(m["payouts"], 4), "surge": self.surge(),
                            "backlog_cpu": self.backlog("cpu"), "backlog_gpu": self.backlog("gpu"),
                            **self._counts()})
        del self.series[:-7 * 24 * 60 // SERIES_EVERY_MIN]

    def elapsed_days(self):
        return max((self.now - START_MIN) / 1440, 1 / 48)

    def kpis(self):
        m = self.money
        revenue = m["revenue"] - m["refunds"]
        profit = m["fees"] - m["refunds"] - m["verify_cost"]
        days = self.elapsed_days()
        n = max(len(self.devices), 1)
        return {"revenue": revenue, "gross": m["revenue"], "fees": m["fees"], "payouts": m["payouts"],
                "refunds": m["refunds"], "verify_cost": m["verify_cost"], "electricity": m["electricity"],
                "contributor_net": m["payouts"] - m["electricity"], "profit": profit,
                "margin": profit / revenue if revenue > 0 else 0.0, "profit_per_month": profit / days * 30,
                "profit_per_device_month": profit / days * 30 / n, "cpu_hours": m["cpu_hours"],
                "gpu_hours": m["gpu_hours"], "lost_hours": m["lost_hours"],
                "backlog_cpu": self.backlog("cpu"), "backlog_gpu": self.backlog("gpu"), "surge": self.surge(),
                "devices": len(self.devices), **self._counts()}

    def device_row(self, d):
        days = self.elapsed_days()
        elec = d["kwh"] * self.cfg["electricity"]
        attempts = d["done"] + d["preempted"]
        completion = d["done"] / attempts if attempts else 1.0
        pass_rate = d["passed"] / d["checked"] if d["checked"] else 1.0
        score = 0 if d["suspended"] else round(100 * pass_rate * (0.7 + 0.3 * completion))
        return {"id": d["id"], "name": d["name"], "label": d["label"], "cls": d["cls"], "kind": d["kind"],
                "state": "suspended" if d["suspended"] else ("working" if d["task"] else d["state"]),
                "done": d["done"], "preempted": d["preempted"], "checked": d["checked"], "passed": d["passed"],
                "hours": round(d["hours"], 3), "gross": d["gross"], "fees": d["fees"], "earned": d["earned"],
                "electricity": elec, "net": d["earned"] - elec, "net_per_month": (d["earned"] - elec) / days * 30,
                "reliability": score, "completion": completion}

    def class_economics(self):
        out = {}
        for cls, c in CLASSES.items():
            rows = [self.device_row(d) for d in self.devices.values() if d["cls"] == cls and d["kind"] == "sim"]
            if not rows:
                continue
            out[cls] = {"label": c["label"], "count": len(rows),
                        "net_per_month": sum(r["net_per_month"] for r in rows) / len(rows),
                        "earned": sum(r["earned"] for r in rows), "electricity": sum(r["electricity"] for r in rows),
                        "fees_per_month": sum(r["fees"] for r in rows) / self.elapsed_days() * 30 / len(rows)}
        return out

    def snapshot(self):
        with self.lock:
            devs = sorted(self.devices.values(), key=lambda d: (d["kind"] == "sim", -d["earned"]))
            return {
                "clock": fmt_time(self.now), "hour": int(self.now % 1440) // 60, "paused": self.paused,
                "sim_min_per_sec": self.sim_min_per_sec, "elapsed_days": self.elapsed_days(),
                "scenario": self.scenario, "scenarios": {k: v["label"] for k, v in SCENARIOS.items()},
                "cfg": self.cfg, "kpi": self.kpis(), "classes": self.class_economics(),
                "trust": {**self.trust, "verify_cost": self.money["verify_cost"],
                          "suspended": [self.device_row(d) for d in self.devices.values() if d["suspended"]]},
                "buyers": [{k: b[k] for k in ("name", "kind", "what", "premium", "orders", "spent", "refunds",
                                              "delivered", "late", "satisfaction", "status", "manual")}
                           for b in self.buyers.values()],
                "devices": [self.device_row(d) for d in devs[:40]],
                "orders": [self.order_row(o) for o in self.recent_orders(12)],
                "series": self.series[-200:],
                "events": list(reversed(self.events[-50:])),
            }

    def order_row(self, o):
        return {"id": o["id"], "buyer": o["buyer"], "kind": o["kind"], "what": o["what"], "hours": o["hours"],
                "unit_price": o["unit_price"], "surge": o["surge"], "price": o["price"], "refund": o["refund"],
                "done": o["done"], "total": len(o["tasks"]), "status": o["status"], "version": o["version"],
                "created": fmt_time(o["created"]), "due": fmt_time(o["deadline"]),
                "delivered": fmt_time(o["delivered_at"]) if o["delivered_at"] else None,
                "overdue": o["status"] == "running" and self.now > o["deadline"]}

    def invoices(self, buyer=None):
        with self.lock:
            rows = [self.order_row(o) for o in sorted(self.orders.values(), key=lambda o: o["created"], reverse=True)
                    if buyer is None or o["buyer"] == buyer]
            return rows

    def statement(self, device_id):
        with self.lock:
            d = self.devices.get(device_id)
            if not d:
                return None
            r = self.device_row(d)
            r["cores"], r["watts"], r["joined"] = d["cores"], d["watts"], fmt_time(d["joined"])
            r["take_rate"], r["electricity_rate"] = self.cfg["take_rate"], self.cfg["electricity"]
            return r

    def all_devices(self):
        with self.lock:
            return [self.device_row(d) for d in sorted(self.devices.values(), key=lambda d: (d["kind"] == "sim", d["name"]))]

    def summary(self, label=""):
        with self.lock:
            return {"label": label or SCENARIOS.get(self.scenario, {}).get("label", self.scenario),
                    "saved_at": datetime.now().isoformat(timespec="seconds"), "sim_days": round(self.elapsed_days(), 2),
                    "cfg": self.cfg, "kpi": self.kpis(), "classes": self.class_economics(), "trust": dict(self.trust),
                    "buyers": [{k: b[k] for k in ("name", "orders", "delivered", "late", "spent", "status")}
                               for b in self.buyers.values()]}

    # ============================================================ live fleet
    def sync_live(self):
        env = load_env()
        url, key = env.get("NEXT_PUBLIC_SUPABASE_URL"), env.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            with self.lock:
                self.cfg["live_fleet"] = False
                self.log("Can't mirror live devices: dashboard/.env.local not found.", "bad")
            return
        req = urllib.request.Request(f"{url.rstrip('/')}/rest/v1/devices?select=id,name,cores,gpu_model,status,agent_version")
        req.add_header("apikey", key)
        req.add_header("Authorization", f"Bearer {key}")
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                rows = json.load(r)
        except Exception as e:
            with self.lock:
                self.log(f"Couldn't read live devices ({e}).", "warn")
            return
        with self.lock:
            if not self.cfg["live_fleet"]:
                return
            existing = {d.get("live_id"): d for d in self.devices.values() if d["kind"] == "live"}
            for row in rows:
                if str(row.get("agent_version") or "").endswith("-demo"):
                    continue  # skip "Load demo data" devices
                d = existing.pop(row["id"], None)
                if not d:
                    d = self._new_device(f"Live · {row['name']}", "gaming" if row.get("gpu_model") else "laptop",
                                         "live", cores=row.get("cores") or 8)
                    d["live_id"] = row["id"]
                    self.log(f"Mirroring live device {row['name']} from your dashboard.", "good")
                state = {"idle": "idle", "in_use": "in_use", "online": "in_use"}.get(row.get("status"), "asleep")
                self._set_state(d, state)
            for d in existing.values():
                self._release(d)
                del self.devices[d["id"]]


# ===================================================================== HTTP
class Handler(BaseHTTPRequestHandler):
    market = None

    def log_message(self, *args):
        pass

    def _send(self, body, ctype, status=200, extra=None):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, status=200):
        self._send(json.dumps(obj).encode(), "application/json", status)

    def _csv(self, name, rows):
        buf = io.StringIO()
        if rows:
            w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        self._send(buf.getvalue().encode(), "text/csv; charset=utf-8",
                   extra={"Content-Disposition": f'attachment; filename="{name}"'})

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return {}

    def do_GET(self):
        mk = self.market
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        path = url.path
        if path in ("/", "/index.html"):
            with open(os.path.join(HERE, "index.html"), "rb") as f:
                return self._send(f.read(), "text/html; charset=utf-8")
        if path == "/logo.svg":
            try:
                with open(LOGO_FILE, "rb") as f:
                    return self._send(f.read(), "image/svg+xml")
            except OSError:
                return self._json({"error": "No logo."}, 404)
        if path == "/api/state":
            return self._json(mk.snapshot())
        if path == "/api/quote":
            with mk.lock:
                try:
                    hours = max(0.25, min(float(q.get("hours", 8)), 500))
                except ValueError:
                    hours = 8
                return self._json(mk.quote("gpu" if q.get("kind") == "gpu" else "cpu", hours))
        if path == "/api/invoices":
            return self._json(mk.invoices(q.get("buyer")))
        if path == "/api/devices":
            return self._json(mk.all_devices())
        if path == "/api/statement":
            s = mk.statement(q.get("device"))
            return self._json(s) if s else self._json({"error": "Unknown device."}, 404)
        if path == "/api/runs":
            runs = []
            if os.path.isdir(RUNS_DIR):
                for name in sorted(os.listdir(RUNS_DIR), reverse=True)[:20]:
                    try:
                        with open(os.path.join(RUNS_DIR, name), encoding="utf-8") as f:
                            runs.append({"file": name, **json.load(f)})
                    except (OSError, ValueError):
                        pass
            return self._json(runs)
        if path == "/export/invoices.csv":
            return self._csv("nightshift-sandbox-invoices.csv", mk.invoices())
        if path == "/export/payouts.csv":
            return self._csv("nightshift-sandbox-payouts.csv", mk.all_devices())
        if path == "/export/timeseries.csv":
            with mk.lock:
                return self._csv("nightshift-sandbox-timeseries.csv", list(mk.series))
        if path == "/export/summary.json":
            body = json.dumps(mk.summary(), indent=2).encode()
            return self._send(body, "application/json",
                              extra={"Content-Disposition": 'attachment; filename="nightshift-sandbox-run.json"'})
        if path.startswith("/api/orders/") and path.endswith("/image"):
            o = mk.orders.get(path.split("/")[3])
            if not o or o["kind"] != "cpu":
                return self._json({"error": "No preview for this order."}, 404)
            with mk.lock:
                data = base64.b64encode(bytes(o["image"])).decode()
            return self._json({"size": mandel.IMAGE, "max": mandel.MAX_ITER, "data": data, "version": o["version"]})
        self._json({"error": "Not found."}, 404)

    def do_POST(self):
        mk, body = self.market, self._body()
        path = urlparse(self.path).path
        if path == "/api/control":
            with mk.lock:
                a = body.get("action")
                if a == "pause":
                    mk.paused = True
                elif a == "resume":
                    mk.paused = False
                elif a == "speed":
                    mk.sim_min_per_sec = min(max(float(body.get("value", 2)), 0.25), 60)
                elif a == "reset":
                    mk.reset()
                elif a == "config":
                    mk.apply_config(body.get("values") or {})
                elif a == "scenario":
                    mk.apply_scenario(body.get("name"))
                elif a == "order":
                    name = str(body.get("buyer") or "").strip()[:60]
                    if not name:
                        return self._json({"error": "Enter a buyer name."}, 400)
                    try:
                        hours = float(body["hours"]) if body.get("hours") else None
                        deadline = float(body["deadline_h"]) if body.get("deadline_h") else None
                    except (TypeError, ValueError):
                        return self._json({"error": "Hours and deadline must be numbers."}, 400)
                    kind = body.get("kind") if body.get("kind") in ("cpu", "gpu") else None
                    o = mk.place_order(name, hours, deadline, kind)
                    return self._json({"ok": True, "order": mk.order_row(o)})
            return self._json({"ok": True})
        if path == "/api/runs/save":
            os.makedirs(RUNS_DIR, exist_ok=True)
            s = mk.summary(str(body.get("label") or "")[:80])
            name = f"run-{datetime.now():%Y%m%d-%H%M%S}.json"
            with open(os.path.join(RUNS_DIR, name), "w", encoding="utf-8") as f:
                json.dump(s, f, indent=2)
            return self._json({"ok": True, "file": name})

        with mk.lock:  # real devices (worker.py)
            if path == "/api/worker/register":
                cores = int(body.get("cores") or 8)
                d = mk._new_device(str(body.get("name", "My computer"))[:60], "laptop", "real", cores=cores)
                mk.log(f"{d['name']} joined as a real device ({cores} cores).", "good")
                return self._json({"device_id": d["id"]})
            d = mk.devices.get(body.get("device_id"))
            if not d or d["kind"] != "real":
                return self._json({"error": "Unknown device. Restart the worker."}, 404)
            d["last_seen"] = time.time()
            if path == "/api/worker/poll":
                state = body.get("state") if body.get("state") in ("idle", "in_use", "battery") else "in_use"
                if not d["task"]:
                    d["state"] = state
                elif state != "idle":
                    mk._set_state(d, state)
                return self._json({"task": mk.lease_to_real(d), "suspended": d["suspended"]})
            if path == "/api/worker/result":
                try:
                    data = base64.b64decode(body.get("data", ""))
                except ValueError:
                    data = b""
                ok = mk.real_result(d, body.get("task_id"), data)
                return self._json({"ok": ok, "earned": round(d["earned"], 5)})
            if path == "/api/worker/abort":
                t = mk.tasks.get(body.get("task_id"))
                if t and t["device"] == d["id"]:
                    d["state"] = "in_use"
                    mk._requeue(t, d, f"{d['name']}: owner came back; task handed to another device.")
                return self._json({"ok": True})
        self._json({"error": "Not found."}, 404)


def main():
    pool = ProcessPoolExecutor(max_workers=max(2, min(6, (os.cpu_count() or 4) - 2)))
    market = Market(pool)
    Handler.market = market

    def loop():
        last = time.monotonic()
        while True:
            time.sleep(TICK_SEC)
            now = time.monotonic()
            try:
                market.tick(now - last)
            except Exception as e:
                market.log(f"Internal error: {e!r}", "bad")
            last = now

    def live_loop():
        while True:
            if market.cfg["live_fleet"]:
                market.sync_live()
            time.sleep(30 if market.cfg["live_fleet"] else 2)

    threading.Thread(target=loop, daemon=True).start()
    threading.Thread(target=live_loop, daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Nightshift marketplace sandbox: http://127.0.0.1:{PORT}  (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        pool.shutdown(cancel_futures=True)


if __name__ == "__main__":
    main()
