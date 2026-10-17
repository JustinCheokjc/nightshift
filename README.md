# Nightshift

**Idle hours, put to work.** Nightshift measures how much usable compute everyday laptops have while their owners are away, the first step towards a marketplace that rents that spare capacity to teams with batch work.

- Website: https://nightshift-sg.vercel.app
- Contributor dashboard: https://nightshift-user.vercel.app
- Public demo (sample data, no sign-in): https://nightshift-user.vercel.app/demo

---

## Problem Statement

**What problem are we solving?** Most personal laptops are idle for most of the day: overnight, during lectures and meetings, and whenever their owners step away. That processing power is already paid for, yet it goes to waste. Meanwhile, small teams that need compute for batch work (AI inference and evaluation runs, rendering, data processing, research simulations) pay cloud prices that rise quickly with demand, especially for GPUs.

**Who experiences it?**
- **Students and laptop owners**, whose devices sit unused for hours with no way to earn from them.
- **Small buyers** such as AI startups, studios and university labs, who need short bursts of affordable compute but cannot justify reserved cloud capacity.

**Why is it worth solving?** Volunteer computing projects like Folding@home have shown that pooled consumer devices can do real work. But nobody knows how much *usable* idle time an ordinary laptop offers: plugged in, untouched, not busy, and reliable enough to schedule. A compute marketplace built on guesses would overpromise to buyers and underdeliver to contributors. Nightshift answers that question first, with real measurements, before any jobs run.

## Solution Overview

Nightshift is built in phases. **Phase 1 (this repository) is measurement only**: no compute jobs run on contributors' machines.

1. A contributor signs up on the dashboard, clicks **Add a device**, and gets a one-hour setup key.
2. They install the lightweight **Nightshift agent** (Windows, macOS or Linux) and paste in the key. The agent shows a plain-language privacy notice and asks for consent.
3. Every 60 seconds the agent reports device *state only*: plugged in or not, battery level, seconds since the last keyboard or mouse input, CPU and memory use, and whether the screen is locked or a full-screen app is playing.
4. The server decides whether each minute was **usable idle** (plugged in, untouched for the idle threshold, CPU under the threshold, no full-screen video). Contributors can change those thresholds on the dashboard without updating the agent.
5. The dashboard turns readings into idle timelines, usable core-hours, estimated earnings against estimated electricity cost, and simple security health checks. **AI insights** (OpenAI GPT) explain each device's idle pattern in plain English and give step-by-step fixes for failed security checks.
6. An **operator console** shows fleet-wide capacity, a typical-day forecast by hour, hardware mix, quiet devices and open security flags, plus an **AI daily briefing** with risks and next steps.

A separate **market sandbox** simulates Phase 2: fictional buyers place orders, tasks are split across simulated and real idle devices, results are spot-checked, and the economics (revenue, fees, payouts, refunds, verification cost) are tracked. No real money moves.

## Key Features

**Desktop agent** (`agent/`)
- One Python file, packaged as standalone executables for Windows, macOS (Apple silicon) and Linux by GitHub Actions.
- Consent-first: shows the privacy notice on first run, and re-asks whenever what it collects changes (versioned consent).
- Buffers readings while offline and sends them in a batch when the connection returns.
- Every 6 hours, four yes/no safety checks: firewall on, antivirus on, disk encrypted, and days since the last system update.
- `--check`, `--autostart on|off` and `--uninstall` commands. Pausing from the dashboard stops reporting.

**Contributor dashboard** (`dashboard/`)
- Passwordless email sign-in (magic link).
- Device list with live status (idle, in use, asleep, offline) via realtime updates.
- 24-hour idle strip and weekly trend per device, with plain-English reasons why a minute was *not* usable (e.g. "on battery", "CPU 45%").
- Usable core-hours, estimated earnings and estimated electricity cost at the user's own electricity rate, each with an explanation of the assumptions.
- Security page listing failing safety checks with severity and vetted fix steps, plus **AI help tailored to the exact operating system** with follow-up questions.
- **AI device insights**: a plain-English read of the week (patterns, practical tips, cautions) with the numbers behind each point.
- Controls: pause, idle and CPU thresholds, CSV export, and delete-my-data.
- A simulated wallet and a market view where the user's real devices join a modelled marketplace.

**Operator console** (`/admin`, admin role only)
- Devices enrolled, reporting and usable right now; 7-day core-hours; typical-day capacity forecast by hour.
- Hardware mix, quiet devices that stopped reporting, open security flags, team view and CSV export.
- **AI daily briefing**: capacity and peak times, risks and recommended actions, written from the fleet numbers.

**Website** (`site/`)
- A static marketing site with pages for contributors, buyers, trust and safety, and about, plus an eligibility checker and a pilot sign-up form.
- A 30-second product film with an original, code-generated soundtrack (`site/film/music.py`).
- A help bot: scripted answers for common questions, and an **AI fallback grounded only in the site's FAQ** for everything else.

**Market sandbox** (`sandbox/`)
- A local marketplace simulator with adjustable pricing, take rate and verification settings.
- `worker.py` turns the computer it runs on into a real worker that computes Mandelbrot tiles only while idle, and stops the moment the keyboard or mouse is touched.

## AI Integration

Nightshift uses an **OpenAI GPT model** (`gpt-5.4-mini` by default, configurable with `OPENAI_MODEL`) through the official OpenAI TypeScript SDK, called only from the dashboard's server. Four features use it. Each one follows the same pattern: the server computes a small set of **summary facts**, the model answers in a **fixed JSON shape** (structured outputs), and the page renders that JSON as plain text with an "AI" label.

| Feature | Where | What the AI receives | What it returns |
|---|---|---|---|
| **Device insights** | Device page (`components/ai/DeviceInsights.tsx`) | 7-day totals, daily hours, average idle and in-use minutes for each hour of the day, the idle setting, and counts of minutes that didn't count by reason (on battery, CPU busy, in use) | A headline, 2–4 insights tagged *pattern*, *tip* or *caution*, each citing its numbers, and the most reliable idle window |
| **Security fix assistant** | Security page (`components/ai/SecurityHelp.tsx`) | The operating system name, the failed check, and (optionally) the user's follow-up question | Why it matters, 3–6 steps using the OS's own settings, what to do if stuck, and a caution (e.g. save the recovery key) |
| **Fleet briefing** | Operator console (`components/ai/FleetBriefing.tsx`) | Fleet counts, a typical day by hour, and per-device stats by device **name** (owner emails are never sent) | A headline, capacity summary, risks, next actions, and a statement of how far the data can be trusted |
| **Website help chat** | Every site page (`site/assets/chat.js` → `dashboard/app/api/help`) | The site's FAQ, privacy and trust text (`lib/ai/helpKnowledge.ts`) and the visitor's question | An answer of under 80 words, whether the FAQ actually covers it, and which FAQ entries it used |

All prompts, schemas and fact builders are in `dashboard/lib/ai/features.ts`. The API call, refusal handling and error handling are in `dashboard/lib/ai/client.ts`, and caching and rate limits are in `dashboard/lib/ai/guard.ts`. The public demo (`/demo`) runs the insights and security assistant on sample data, so they can be tried without an account.

AI also shapes the project in two other ways:
- **AI workloads are the demand side.** The buyers Nightshift is built for are largely AI teams: batch inference, embeddings, evaluation runs and fine-tuning. These jobs run in batches and can be interrupted, which suits idle consumer hardware. The market sandbox models such buyers to test pricing and verification.
- **AI-assisted development.** The codebase and documentation were built with Claude Code, with a human reviewing, testing and deploying every change.

**Where we deliberately kept AI out:**
- **Idle detection** is a fixed set of explainable rules (power, input idle time, CPU load, screen lock, full-screen apps), so contributors can see exactly why each minute counted or not. That is the number we may one day pay on.
- **Capacity forecasting** uses hour-of-day averages. With a small pilot fleet, a simple baseline you can inspect is more trustworthy than a trained model. The AI briefing explains the forecast but never changes it.
- **Common help questions** still get word-for-word scripted answers, and they never leave the browser. Only unmatched questions go to the AI.

## External Tools & Datasets

| Tool / service | Used for |
|---|---|
| [Next.js 16](https://nextjs.org) + React 19, TypeScript | Contributor dashboard and operator console |
| [Tailwind CSS 4](https://tailwindcss.com), [Recharts](https://recharts.org), [Framer Motion](https://motion.dev) | Styling, charts, animation |
| [Supabase](https://supabase.com) (Postgres, Auth, Realtime) | Database with row-level security, magic-link sign-in, live device status |
| [Vercel](https://vercel.com) | Hosting for the dashboard and website |
| Python 3, [psutil](https://github.com/giampaolo/psutil), [PyInstaller](https://pyinstaller.org) | Desktop agent and its packaged executables |
| GitHub Actions | Builds and smoke-tests agent binaries on Windows, macOS and Linux |
| [GSAP](https://gsap.com), [Three.js](https://threejs.org) (via cdnjs) | Website scroll animations and 3D architecture scene |
| [PostHog](https://posthog.com) | Privacy-conscious website analytics (no cookies; session storage only; session recording off) |
| [OpenAI API](https://platform.openai.com) — GPT via the `openai` SDK | Device insights, security fix assistant, fleet briefing, help chat (strict structured outputs) |
| [Zod](https://zod.dev) | Schemas for the AI's structured answers |
| ffmpeg | Encoding the product film |

**Datasets and reference data.** No external datasets are used, and no model is trained or fine-tuned; the model is used as-is through the API. Earnings estimates use a reference price of about S$0.02 per core-hour, based on public cloud spot CPU pricing, minus a modelled 30% platform fee. GPU rental prices were researched from public marketplaces (Vast.ai, RunPod, GPUPerHour, FastGPU). All device data comes from the pilot's own consenting contributors. The demo uses hand-made sample data (`dashboard/lib/demoData.ts`).

## Installation & Setup

### Prerequisites
- Node.js 20.9 or newer, and npm
- Python 3.10 or newer (3.12 is used in CI)
- A free [Supabase](https://supabase.com) project

### 1. Clone the repository
```bash
git clone https://github.com/JustinCheokjc/nightshift.git
cd nightshift
```

### 2. Set up the database
1. In your Supabase project, open **SQL Editor** and run the files in `dashboard/supabase/migrations/` in order (`0001_init.sql` to `0006_ai.sql`).
2. Under **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL.

### 3. Configure and run the dashboard
Create `dashboard/.env.local` with values from **Project Settings → API** in Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role / secret key>
# Optional: signs agent setup keys and device tokens. If unset, one is derived from the service role key.
AGENT_SIGNING_SECRET=<a long random string>
# Optional: turns on the AI features. Without it they are hidden and everything else works.
OPENAI_API_KEY=<key from platform.openai.com>
# Optional: which OpenAI model to use (default gpt-5.4-mini).
OPENAI_MODEL=gpt-5.4-mini
# Optional: extra website origins allowed to call the help chat API, comma-separated.
HELP_ALLOWED_ORIGINS=https://your-site.example
```
Then:
```bash
cd dashboard
npm install
npm run dev
```
Open http://localhost:3000, sign in with your email, and follow the magic link. To try the UI without signing in, open http://localhost:3000/demo.

To unlock the operator console at `/admin`, make your account an admin in the Supabase SQL editor:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

### 4. Connect a device with the agent
1. On the dashboard, click **Add a device** and copy the setup key (valid for one hour).
2. Either download the executable for your OS from that dialog, or run the agent from source:
   ```bash
   pip install psutil
   python agent/nightshift_agent.py --setup <SETUP_KEY>
   ```
3. Read and accept the privacy notice. The device appears on the dashboard within a minute.

Useful commands: `--check` prints one reading and exits; `--autostart on` starts the agent at login; `--uninstall` stops it and forgets the device.

### 5. (Optional) Run the website locally
```bash
cd site
python -m http.server 8000
```
Open http://localhost:8000. Links are root-relative, so use a server rather than opening the files directly.

### 6. (Optional) Run the market sandbox
```bash
python sandbox/marketplace.py            # then open http://127.0.0.1:8090
python sandbox/worker.py --idle-after 20 # in a second terminal: add this computer as a real worker
```
If `dashboard/.env.local` exists, the sandbox can also mirror the live idle state of your enrolled devices (read-only).

## AI Safety & Limitations

Nightshift asks people to install software on their personal computers, so the main risks are **privacy, security and misleading claims**. The AI features add their own: made-up answers, prompt injection, data sent to a third party, and cost abuse.

### Key risks
| Risk | Why it matters |
|---|---|
| Over-collection of personal data | An agent that sees keystrokes, files or screens would be spyware. |
| Stolen or forged device credentials | Someone could submit fake readings or read another user's data. |
| Misleading earnings figures | People may install the agent expecting income that real demand won't produce. |
| Weak device security in a future compute network | An unpatched or unprotected device running others' jobs is a risk to both sides. |
| Incorrect results from untrusted devices (Phase 2) | Buyers need to trust work done on hardware they don't control. |
| AI hallucination | An AI answer could invent a privacy promise, an earnings figure or a wrong security step, and people may act on it. |
| Prompt injection | A visitor could type instructions into the help chat to make it say something Nightshift never committed to. |
| Data shared with an AI provider | Anything sent to OpenAI leaves our systems, so it must be the minimum needed. |
| Abuse of the public AI endpoint | Anyone can type into the website chat, which could run up API costs. |

### Guardrails implemented
- **Data minimisation.** The agent collects only device state, never file contents, browsing, keystrokes, screen contents or location. It runs no jobs in Phase 1, and the privacy notice lists exactly what is sent.
- **Versioned consent.** Consent is recorded per version (`consent_log`). Safety checks are sent only after the user accepts the version that adds them (`agent-2`).
- **No database keys on contributor machines.** Devices enrol with a short-lived, HMAC-signed setup key, then use a signed per-device token. Deleting a device revokes its token, and the agent is told to stop.
- **Row-level security** on every table. Contributors can read only their own devices and readings, and fleet-wide data is admin-only.
- **Server-side validation.** Readings are clamped to valid ranges. Timestamps older than 7 days or in the future are rejected, and batches are capped at 1,500 readings.
- **User control.** Users can pause, change thresholds, export CSV, or delete all their data at any time. The agent can be uninstalled with one command.
- **Honest estimates.** Every earnings and electricity figure has an "i" tooltip stating its assumptions, including that it "assumes every idle hour sells, which real demand won't match." Sample data is labelled as such.
- **Privacy-conscious analytics.** No cookies and no session recording, and the help bot never records what visitors type.
- **AI grounded in facts, not free rein.** Every AI feature receives server-computed summary facts or the site's own FAQ, and its prompt forbids inventing numbers, promising earnings, or advising anyone to disable protections or share recovery keys. The help chat must say when the FAQ doesn't cover a question (`answerable: false`); the site then falls back to the scripted "email a person" reply instead of guessing.
- **Scripted first.** Common help questions get word-for-word scripted answers in the browser. Only unmatched questions reach the AI. The security page keeps its vetted fix steps, and AI help is an extra button below them.
- **Structured outputs, rendered as text.** The model must answer in a fixed JSON schema (Zod), which the pages render as plain text, never as HTML. The help chat only accepts topic ids that exist in the knowledge base.
- **Prompt-injection handling.** User text is wrapped in `<question>` tags and the prompts say it is never instructions. The security assistant flags off-topic questions (`on_topic: false`) and declines them.
- **Minimal data to the AI.** Only aggregates (hours, counts, OS name, the idle setting) are sent. The fleet briefing uses device names, never owner emails. No question text is stored: the cache keys answers by a hash of the question, and rate limits key on a hashed IP.
- **Refusals and failures handled.** Model refusals, content-filter stops, truncated answers, rate limits and outages show a clear message and leave the rest of the page working. Without an API key the AI features are hidden entirely.
- **Abuse and cost limits.** The help API only accepts requests from the Nightshift site's origins and questions of up to 300 characters. It allows 12 questions per IP per hour and 500 a day overall. Signed-in features are limited per user (for example 15 device analyses a day), and answers are cached (help answers for a week, security steps per OS and check for 30 days, demo insights per day).
- **Clearly labelled.** Every AI block carries an "AI" badge, when it was generated, and a note that AI can be wrong. The website's privacy notice and chat footer say which questions go to OpenAI.
- **Result verification (sandbox).** The marketplace simulation rechecks every device's first results and a random 5% of later results by recomputing them, to measure what verification costs.

### Testing done
- **Cross-platform build checks.** On every agent change, CI builds the Windows, macOS and Linux executables and runs `--check` on each to confirm it collects a reading.
- **End-to-end pilot.** A real Windows laptop was enrolled and has reported through the live dashboard, testing setup, offline buffering, pausing, threshold changes and safety checks.
- **Manual testing** of sign-in, device enrolment and removal, data export and deletion, and the admin-only console, plus a public demo built on sample data.
- **Marketplace simulation runs** to stress-test pricing, take rate and verification settings under simulated day and night device habits.
- **Linting** with ESLint, type-checking with TypeScript, and a production build of the dashboard.
- **AI endpoint checks** against a running production build: requests with no origin or an unknown origin are refused (403), the CORS preflight succeeds only for the site's origin, too-short questions are rejected (400), the 13th question in an hour from one IP gets a 429, and a bad API key returns a clean error instead of crashing. AI cards render on the public demo pages, and pages still work with AI switched off.
- **Fact inspection.** The exact JSON sent to the AI was printed for the demo devices to confirm it holds only aggregates.

### Known limitations
- **Small sample.** Pilot data so far comes from very few devices, so forecasts and per-device averages are not yet statistically meaningful, and no forecast error rate has been measured.
- **Simple forecast.** The capacity forecast is an hour-of-day average and does not account for weekends, holidays or exam periods.
- **Estimates, not earnings.** Payouts assume every usable idle hour is sold at a cloud-like price. Real demand, prices and electricity use have not been measured.
- **Self-reported safety checks.** Firewall, antivirus and encryption status come from the agent and could be faked by a modified client. They support decisions; they do not prove anything.
- **Unsigned binaries.** The agent executables are not code-signed yet, so Windows SmartScreen and macOS Gatekeeper show warnings. Signed installers and auto-update are planned.
- **No automated test suite yet.** Testing is mostly manual plus CI smoke checks. Unit tests for idle classification and the report API are a priority.
- **AI can still be wrong.** Grounding and schemas reduce made-up answers but can't eliminate them, which is why AI output is labelled and never drives payouts, idle decisions or security flags. There is no automated evaluation set for AI answer quality yet.
- **Two copies of the FAQ.** The help chat's knowledge base (`dashboard/lib/ai/helpKnowledge.ts`) mirrors the scripted answers in `site/assets/chat.js`, so a change to one must be copied to the other.
- **Rate limits need migration 0006.** Without the `ai_usage` table, limits fall back to each server instance's memory, which serverless hosting can reset.
- **Phase 2 is not built.** Sandboxed job execution, real buyer workloads and real payouts exist only in the simulator. The current agent cannot run jobs.

## Repository Structure

```
agent/       Cross-platform Python desktop agent
dashboard/   Next.js contributor dashboard, operator console, agent API and AI features (lib/ai/)
  supabase/migrations/   Database schema and row-level security policies
site/        Static marketing website, product film and help bot
sandbox/     Local marketplace simulator and real idle-time worker
.github/     CI that builds the agent executables
phase1-product-spec.md   Phase 1 product specification
```
