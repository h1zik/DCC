"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CompareRow = {
  label: string;
  positive: number;
  neutral: number;
  negative: number;
};

export function CrossCompareChart({ data }: { data: CompareRow[] }) {
  if (data.length === 0) return null;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
            unit="%"
          />
          <Tooltip
            formatter={(v) =>
              typeof v === "number" ? `${v.toFixed(1)}%` : "—"
            }
          />
          <Legend />
          <Bar dataKey="positive" name="Positif" fill="#22c55e" stackId="a" />
          <Bar dataKey="neutral" name="Netral" fill="#94a3b8" stackId="a" />
          <Bar dataKey="negative" name="Negatif" fill="#ef4444" stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
