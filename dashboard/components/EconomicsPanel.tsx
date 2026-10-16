"use client";

import { useState } from "react";
import AnimatedNumber from "@/components/AnimatedNumber";
import InfoTip from "@/components/InfoTip";
import { DEFAULT_ELECTRICITY_RATE, IDLE_POWER_DRAW_KW } from "@/lib/estimates";

// What the fleet's measured capacity would earn if it all sold, at a buyer price
// and take rate the operator can try out. Defaults match sandbox/marketplace.py.
export default function EconomicsPanel({
  coreHoursPerDay,
  idleHoursPerDay,
  devicesEnrolled,
}: {
  coreHoursPerDay: number;
  idleHoursPerDay: number;
  devicesEnrolled: number;
}) {
  const [price, setPrice] = useState(0.02); // S$ per core-hour paid by buyers
  const [take, setTake] = useState(0.3); // Nightshift's share

  const revenue = coreHoursPerDay * 30 * price;
  const payout = revenue * (1 - take);
  const fee = revenue * take;
  const electricity = idleHoursPerDay * 30 * IDLE_POWER_DRAW_KW * DEFAULT_ELECTRICITY_RATE;
  const netPerDevice = devicesEnrolled ? (payout - electricity) / devicesEnrolled : 0;

  const rows: [string, number, string?][] = [
    ["Buyers pay", revenue],
    [`Paid to contributors (${Math.round((1 - take) * 100)}%)`, payout],
    [`Nightshift keeps (${Math.round(take * 100)}%)`, fee],
    ["Contributors' electricity", -electricity],
    ["Net per device, after electricity", netPerDevice, "bold"],
  ];

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title flex items-center gap-1.5">
            Monthly economics
            <InfoTip text="Last 7 days of measured core-hours, scaled to a month, assuming every idle hour sells. Real demand will be lower." />
          </h2>
          <p className="card-sub">If this week&apos;s measured capacity sold every month.</p>
        </div>
      </div>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 flex items-center justify-between text-[13px] font-medium">Buyer price
            <output className="rounded-md bg-[color-mix(in_srgb,var(--idle)_12%,transparent)] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--idle)]">S${price.toFixed(3)}/core-h</output>
          </span>
          <input type="range" min={0.005} max={0.06} step={0.001} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full accent-[var(--idle)]" />
          <span className="text-xs text-[var(--mut)]">Cloud spot CPU is roughly S$0.01–0.03.</span>
        </label>
        <label className="block">
          <span className="mb-1 flex items-center justify-between text-[13px] font-medium">Nightshift&apos;s cut
            <output className="rounded-md bg-[color-mix(in_srgb,var(--idle)_12%,transparent)] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--idle)]">{Math.round(take * 100)}%</output>
          </span>
          <input type="range" min={0} max={0.6} step={0.01} value={take} onChange={(e) => setTake(Number(e.target.value))} className="w-full accent-[var(--idle)]" />
          <span className="text-xs text-[var(--mut)]">Share of what buyers pay.</span>
        </label>
      </div>
      <dl className="mt-5 grid grid-cols-[1fr_auto] gap-y-2 border-t border-[var(--line)] pt-4 text-[13px]">
        {rows.map(([label, v, bold]) => (
          <div key={label} className="contents">
            <dt className={bold ? "border-t border-[var(--line)] pt-2 font-semibold" : "text-[var(--mut)]"}>{label}</dt>
            <dd className={`text-right tabular-nums ${bold ? "border-t border-[var(--line)] pt-2 font-semibold" : ""}`}>
              <AnimatedNumber value={Math.abs(v)} decimals={2} prefix={v < 0 ? "−S$" : "S$"} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
