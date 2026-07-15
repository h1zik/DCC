"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Tooltip recharts selaras skin bento (kartu solid hangat). */
const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--foreground)",
} as const;

type Bucket = {
  month: string;
  positive: number;
  neutral: number;
  negative: number;
};

export function ReviewTimelineChart({ data }: { data: Bucket[] }) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada data timeline.</p>
    );
  }

  const chartData = data.map((b) => ({
    label: b.month,
    Positif: b.positive,
    Netral: b.neutral,
    Negatif: b.negative,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            stroke="var(--muted-foreground)"
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="Positif"
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="Netral"
            stroke="var(--muted-foreground)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="Negatif"
            stroke="var(--destructive)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
