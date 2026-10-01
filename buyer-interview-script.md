# Buyer Discovery Interview Script: Idle Compute Marketplace

## Goal
Find ONE workload type that a buyer already pays for today, would move to distributed idle laptops, and could commit to a pilot. You are testing demand, not pitching.

**Target:** 15-20 interviews over 4-6 weeks, then pick the strongest workload.

## Who to talk to
Prioritize people who already buy compute or run batch jobs:
- 3D rendering and animation studios, architecture visualization firms
- Data labeling / data processing startups
- Bioinformatics, chemistry, or university research labs with batch simulations
- AI startups doing inference, embeddings, or evaluation runs
- Video transcoding and media processing companies
- Quant/backtesting teams (note: expect strict security limits)

Find them through SMU faculty and alumni, LinkedIn, startup communities, and research groups. Ask for an intro rather than cold-pitching where possible.

## Outreach message (short)
> Hi [Name], I'm a student at SMU researching how teams handle compute-heavy batch jobs like [rendering / simulations / data processing]. I'm not selling anything. Could I ask you 20 minutes of questions about how you run these today and what's painful? Happy to share what I learn from other teams.

## Interview flow (20-30 min)

### 1. Context (3 min)
- What does your team do, and what compute-heavy work do you run?
- Roughly how often, and how big are the jobs?

### 2. Current setup and spend (7 min)
- Where do these jobs run today? (Own hardware, AWS/GCP/Azure, render farm, GPU marketplaces)
- What do you spend per month on it, roughly?
- What did you try before the current setup, and why did you switch?
- Tell me about the last time a big job was slow, expensive, or failed. What happened?

### 3. Pain and priorities (5 min)
- What matters most: cost, speed, reliability, ease, security? Rank them.
- What would make you never use a given provider?
- Are there deadlines that create sudden spikes in demand?

### 4. Fit for distributed idle hardware (7 min)
Only now describe the idea in two sentences: "Jobs are split into small pieces and run on a network of vetted laptops and desktops during their idle time, at a lower price."
- Could any of your work run this way? Which parts, and which couldn't?
- What data restrictions apply? Could the data leave your environment, and would encryption or anonymization be required?
- What would you need to see before trusting it? (Verification, SLAs, references, audits)
- How much cheaper would it need to be to be worth the switching effort?

### 5. Commitment test (3 min)
- If we ran a free pilot on a non-sensitive job, who would need to approve it?
- Would you run a real job through it in the next 60 days? What would that job be?
- Would you pay for a pilot, even a small amount?
- Who else should I talk to?

## Rules for the interview
- Ask about past behavior ("what did you do last time"), not hypotheticals ("would you use").
- Don't pitch until section 4. Let them describe the problem first.
- Compliments and "sounds interesting" are not validation. Money, time, or an intro are.
- Stay silent after a question; let them fill the pause.

## Log after each interview
| Field | Notes |
|---|---|
| Company / role | |
| Workload type | |
| Current provider and monthly spend | |
| Top pain | |
| Data sensitivity | |
| Price they'd need | |
| Reliability needs (SLA, deadlines) | |
| Commitment level (none / intro / free pilot / paid pilot) | |
| Follow-up | |

## Scoring workloads (after 10+ interviews)
Score each workload 1-5 on:
1. **Pain:** how badly do buyers want a cheaper or more available option?
2. **Fit:** can the job be split into small, independent, fault-tolerant pieces?
3. **Data risk:** can it run on untrusted machines? (5 = no sensitive data)
4. **Willingness to pay:** any commitment to pilot or pay?
5. **Volume:** enough recurring demand to keep the fleet busy?

Pick the workload with the highest total that also has at least one buyer willing to run a pilot.

## Red flags
- Everyone says "interesting" but nobody offers a pilot or an intro
- The only workloads with demand involve sensitive data
- Required price is below what contributors' electricity costs would allow
- Jobs need low latency, large data transfers, or tightly coupled compute
