"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

export default function WeeklyTrendChart({
  data,
}: {
  data: { date: string; hours: number }[];
}) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const formatted = sorted.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "short",
    }),
  }));

  return (
    <div className="h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="idleFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1f8a7d" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#1f8a7d" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--mut)" }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)} h`, "Usable idle"]}
            contentStyle={{
              background: "var(--surf)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="hours"
            stroke="#1f8a7d"
            strokeWidth={2}
            fill="url(#idleFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
