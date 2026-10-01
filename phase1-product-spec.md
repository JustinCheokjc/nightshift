# Phase 1 Product Spec: Idle Compute Measurement Platform

## 1. Goal
Measure how much usable idle compute a fleet of laptops really offers. No paid jobs, no marketplace yet.

**Key question Phase 1 must answer:** how many usable core-hours per device per day do we get, and how predictable are they by hour of day?

**Success criteria**
- 50-200 pilot devices enrolled
- 30+ days of continuous telemetry
- A forecast of available core-hours by hour of day, with a stated error rate
- A per-device economics estimate (potential payout vs. electricity cost)

## 2. Scope
**In scope:** desktop agent (telemetry only), backend ingestion, contributor dashboard, operator dashboard, pilot onboarding.
**Out of scope:** running buyer workloads, billing, payouts, buyer portal, GPU job execution.

## 3. Definition of "usable idle"
A device counts as usable idle when ALL are true:
- Awake (not sleeping or shut down)
- Plugged into power
- No keyboard/mouse input for 5+ minutes (configurable)
- CPU utilization below 20% (configurable)
- Not in a user-defined blackout window

The agent logs both raw state and this derived flag so thresholds can be tuned later without re-collecting data.

## 4. Components

### 4.1 Desktop agent (Windows, macOS; Linux optional)
- Lightweight background service (Rust or Go preferred; under 50 MB RAM, under 1% CPU)
- Collects every 60 seconds: power state (plugged/battery, battery %), input idle time, CPU/GPU/RAM utilization, sleep/wake events, network type and throughput
- Collects once at install: CPU model and cores, GPU model and VRAM, RAM, OS, disk free space
- Optional short benchmark run during idle (e.g., fixed CPU workload) to record real performance per device
- Buffers data locally if offline and syncs when connected
- Signed installer, auto-update, one-click pause and uninstall
- Explicit consent screen stating exactly what is collected; **no file contents, browsing data, or keystrokes**

### 4.2 Backend
- Device registration and authentication (per-device tokens)
- Telemetry ingestion API with batching
- Time-series storage (TimescaleDB or similar), with retention policy
- Aggregation jobs: per-device daily summaries, fleet hourly capacity
- Simple forecasting job (start with hour-of-day/day-of-week averages before anything fancy)
- Admin API for exports (CSV)

### 4.3 Contributor dashboard (web)
- Login, device list with live status (online, idle, in use, asleep, offline)
- Idle timeline per device (24h and 7-day heatmap)
- Usable core-hours per day/week
- Estimated potential earnings and estimated electricity cost (using a rate the user can set)
- Controls: pause, blackout schedule, idle thresholds, delete my data

### 4.4 Operator dashboard (web, admin only)
- Fleet totals: devices online now, enrolled, active in last 7 days
- Available core-hours now, and forecast by hour of day and day of week
- Distribution charts: hardware mix, usable idle hours per device, uptime
- Cohort views (by OS, hardware tier, user group)
- Churn: devices that stopped reporting
- Economics panel: assumed price per core-hour, projected revenue, per-device electricity cost, net margin
- Data export

## 5. Data model (core tables)

| Table | Key fields |
|---|---|
| users | id, email, role (contributor/admin), created_at, electricity_rate |
| devices | id, user_id, os, cpu_model, cores, gpu_model, vram_gb, ram_gb, benchmark_score, agent_version, enrolled_at, status |
| telemetry | device_id, ts, awake, plugged_in, input_idle_sec, cpu_pct, gpu_pct, ram_pct, net_type, usable_idle (bool) |
| sessions | device_id, start_ts, end_ts, type (usable_idle/in_use/asleep/offline) |
| daily_summary | device_id, date, usable_idle_hours, core_hours, uptime_hours |
| fleet_hourly | ts, devices_online, devices_usable, core_hours_available |
| settings | device_id, idle_threshold_min, cpu_threshold_pct, blackout_windows |
| consent_log | user_id, version, accepted_at |

## 6. Non-functional requirements
- **Privacy:** collect the minimum; user can view and delete all their data; consent versioned and logged
- **Security:** TLS everywhere, per-device tokens, signed agent builds, no inbound ports opened on user machines
- **Reliability:** agent survives offline periods and restarts; ingestion is idempotent
- **Scale target:** 500 devices at 1 sample/min (about 720k rows/day) with room to grow
- **Compliance:** confirm PDPA (Singapore) obligations before recruiting any pilot users

## 7. Milestones (indicative)
1. **Weeks 1-2:** finalize spec, telemetry schema, agent prototype on one OS
2. **Weeks 3-5:** ingestion backend, agent on second OS, installer and auto-update
3. **Weeks 5-7:** contributor dashboard, operator dashboard v1 (Grafana acceptable for admin view)
4. **Week 8:** internal pilot (10 devices), fix issues
5. **Weeks 9+:** recruit and run the 50-200 device pilot, collect 30+ days of data

## 8. Team and roles to hire

**Systems engineer (agent + backend), Rust/Go**
- Experience with cross-platform background services, OS power/idle APIs, installers, code signing
- Nice to have: distributed systems, sandboxing (containers/WASM) for Phase 2

**Full-stack developer (dashboards)**
- React/TypeScript, charting libraries, REST APIs, SQL/time-series queries
- Nice to have: Grafana, auth, role-based access

**Part-time:** designer for the contributor UI, and a privacy/legal reviewer for consent terms.

## 9. Job description (copy/paste for freelancers)

> **Build a desktop telemetry agent and analytics dashboard (8-10 week project)**
>
> We're building a platform that measures idle compute on laptops. We need a background agent (Windows/macOS) that reports device state (awake, plugged in, idle, CPU/GPU load) to a backend, plus web dashboards for contributors and administrators.
>
> **You'll deliver:** the agent with signed installers and auto-update, a telemetry ingestion API and time-series database, a contributor dashboard, an operator dashboard with capacity forecasting, and documentation.
>
> **Required:** Rust or Go; cross-platform system APIs; REST APIs; PostgreSQL/TimescaleDB; React. Privacy-first design is essential.
>
> **To apply:** share 1-2 examples of background services or dashboards you've shipped, your estimated timeline, and a fixed-price or milestone quote.

## 10. Open questions to resolve before hiring
1. Which OS mix will the pilot users have? (This decides Windows vs. macOS agent priority.)
2. Is GPU capacity a Phase 1 measurement priority? (It raises agent complexity but is where most buyer demand is.)
3. How will pilot users be recruited and incentivized?
4. Where will data be hosted (region), given privacy obligations?
5. Who owns the code and data? Ensure IP assignment in every contractor agreement.

## 11. Acceptance checklist
- [ ] Agent runs 7 days on 10 devices with under 1% missing samples
- [ ] Usable-idle flag matches manual checks on test scenarios (lid closed, on battery, active typing, video call)
- [ ] Contributor can view, pause, and delete data
- [ ] Operator dashboard shows fleet capacity and a forecast by hour
- [ ] CSV export of all aggregated data
- [ ] Documentation for install, deployment, and schema

## 12. Additional scope agreed after the first draft

### 12.1 Security flags (Phase 1: posture checks and flagging panel)
- Agent reports yes/no posture checks: OS patch age, firewall, antivirus, disk encryption, agent file integrity, virtual machine detection.
- Backend turns these into flags with severity (low, medium, high, critical) and a response: note, exclude from sensitive work, pause device, revoke token.
- Operator Security panel: flagged devices, category counts, editable thresholds, audit log. Contributor sees a plain-language fix message.
- New tables: `security_flags` (device_id, category, severity, detail, first_seen, resolved_at, status), `device_posture` (device_id, ts, os_patch_age_days, firewall_on, antivirus_on, disk_encrypted, agent_hash_ok, is_vm), `audit_log` (actor, action, target, ts).
- Limit: agent-reported data can be faked. Stronger checks (sandboxing, duplicate-run verification) arrive in Phase 2.

### 12.2 Wallet (design in Phase 1, live in Phase 3)
- Phase 1 shows the pilot payment and clearly labelled estimates only.
- Use an append-only ledger, not a single balance. Statuses: pending, available, processing, paid, reversed. Hold earnings for about 7 days so failed or flagged work can be reversed.
- New tables: `wallet_accounts`, `ledger_entries` (account_id, type, amount, status, related_job_id, created_at), `payout_requests`, `payout_methods`.
- Avoid holding customer funds. Pay out through a licensed provider (for example Stripe Connect or a PayNow-enabled service) and get Singapore Payment Services Act advice before launch.

### 12.3 GPU pricing reference (Phase 2 analysis)
- Track public GPU rental prices (for example Vast.ai, RunPod, GPUPerHour, FastGPU) and feed them into the operator economics panel.
- Model net earnings per device: idle hours x share with paid work x price x (1 minus platform fee), minus electricity. Replace placeholder laptop-GPU prices with pilot measurements.

### 12.4 Public site and sign-up
- Landing site with contributor and buyer paths, eligibility checker, privacy notice and consent page. See landing-handoff.md.
- Sign-up must record consent (timestamp, policy version) and confirm 18+.
