"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

type FleetHourlyRow = {
  ts: string;
  devices_usable: number;
  devices_online: number;
};

export default function ForecastChart({ rows }: { rows: FleetHourlyRow[] }) {
  const data = rows.map((r) => ({
    hour: new Date(r.ts).getHours(),
    label: `${new Date(r.ts).getHours()}:00`,
    usable: r.devices_usable,
    online: r.devices_online,
  }));

  return (
    <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="label"
            interval={3}
            tick={{ fontSize: 11, fill: "var(--mut)" }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
          />
          <Tooltip
            formatter={(value, name) => [
              String(value),
              name === "usable" ? "Usable devices" : "Online devices",
            ]}
            labelFormatter={(label) => `Hour ${label}`}
            contentStyle={{
              background: "var(--surf)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="usable" fill="#1f8a7d" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
