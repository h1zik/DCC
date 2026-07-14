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
          <Bar dataKey="positive" name="Positif" fill="var(--chart-4)" stackId="a" />
          <Bar dataKey="neutral" name="Netral" fill="var(--muted-foreground)" stackId="a" />
          <Bar dataKey="negative" name="Negatif" fill="var(--destructive)" stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
