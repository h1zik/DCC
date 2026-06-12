"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SeasonalMonth = {
  month: string;
  keywords: string[];
};

export function SeasonalKeywordChart({ data }: { data: SeasonalMonth[] }) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada data musiman.</p>
    );
  }

  const chartData = data.map((d) => ({
    month: d.month,
    count: d.keywords.length,
    keywords: d.keywords.join(", "),
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
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
          <Tooltip
            formatter={(value) => [`${value} keyword`, "Peak"]}
            labelFormatter={(label) => String(label)}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as { month: string; keywords: string };
              return (
                <div className="bg-popover border-border rounded-lg border p-2 text-xs shadow-md">
                  <p className="font-medium">{row.month}</p>
                  <p className="text-muted-foreground mt-1 max-w-48">{row.keywords}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
