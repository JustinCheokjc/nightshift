"use client";

import { useState } from "react";
import AnimatedNumber from "@/components/AnimatedNumber";

const ELECTRICITY_COST_PER_DEVICE = 1.4; // S$ / month, matches the contributor estimate

export default function EconomicsPanel({
  coreHoursPerDay,
  devicesEnrolled,
}: {
  coreHoursPerDay: number;
  devicesEnrolled: number;
}) {
  const [price, setPrice] = useState(4);

  const monthlyRevenue = coreHoursPerDay * 30 * price;
  const payout = monthlyRevenue * 0.6;
  const netPerDevice = devicesEnrolled
    ? (payout - devicesEnrolled * ELECTRICITY_COST_PER_DEVICE) / devicesEnrolled
    : 0;

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-bold">Economics</h3>
      <label className="block text-xs text-[var(--mut)]">
        Price per core-hour (S${price})
      </label>
      <input
        type="range"
        min={1}
        max={10}
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        className="w-full accent-[var(--idle)]"
      />
      <table className="mt-3 w-full text-sm">
        <tbody>
          <tr>
            <td className="py-1 text-[var(--mut)]">Projected monthly revenue</td>
            <td className="py-1 text-right">
              <AnimatedNumber value={monthlyRevenue} prefix="S$" />
            </td>
          </tr>
          <tr>
            <td className="py-1 text-[var(--mut)]">Contributor payout (60%)</td>
            <td className="py-1 text-right">
              <AnimatedNumber value={payout} prefix="S$" />
            </td>
          </tr>
          <tr>
            <td className="py-1 text-[var(--mut)]">Est. electricity cost per device</td>
            <td className="py-1 text-right">S${ELECTRICITY_COST_PER_DEVICE.toFixed(2)}</td>
          </tr>
          <tr>
            <td className="py-1 text-[var(--mut)]">Net per device / month</td>
            <td className="py-1 text-right">
              <AnimatedNumber value={netPerDevice} decimals={2} prefix="S$" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
