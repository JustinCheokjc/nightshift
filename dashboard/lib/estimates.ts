// Assumptions behind every earnings estimate in the dashboard. Shown to people
// through <InfoTip>, so keep the explanations in sync with the numbers.

// Contributor share of what buyers pay: about S$0.02 per core-hour (cloud spot CPU
// pricing) minus Nightshift's 30% cut, as modelled in sandbox/marketplace.py.
// Replace with measured prices once real buyers are paying.
export const EARNING_RATE_PER_CORE_HOUR = 0.014;
export const IDLE_POWER_DRAW_KW = 0.015; // extra draw of a laptop running jobs while idle
export const DEFAULT_ELECTRICITY_RATE = 0.31; // S$ per kWh

export const EXPLAIN = {
  usableIdle:
    "Time a device was awake, plugged in, untouched for your idle setting and under 20% CPU. Locked screens count as away; full-screen video counts as in use.",
  capacity:
    "Usable idle hours × the device's CPU cores. A core-hour is one processor core working for one hour: the unit compute is sold in.",
  earnings: `Core-hours × S$${EARNING_RATE_PER_CORE_HOUR}. That is roughly cloud spot CPU pricing (about S$0.02 per core-hour) minus Nightshift's 30% cut. Assumes every idle hour sells, which real demand won't match.`,
  electricity: `Usable idle hours × ${IDLE_POWER_DRAW_KW * 1000} W extra draw while working × your electricity rate. Laptops idle at a few watts; running jobs adds roughly this much.`,
} as const;
