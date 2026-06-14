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

function norm(keyword: string): string {
  return keyword.trim().toLowerCase();
}

export function SeasonalKeywordChart({
  data,
  volumeByKeyword,
}: {
  data: SeasonalMonth[];
  /** keyword(lowercased) -> monthly search volume; enables volume-based bars */
  volumeByKeyword?: Record<string, number>;
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada data musiman.</p>
    );
  }

  const hasVolume =
    !!volumeByKeyword && Object.keys(volumeByKeyword).length > 0;

  const chartData = data.map((d) => {
    const volume = hasVolume
      ? d.keywords.reduce((sum, kw) => sum + (volumeByKeyword?.[norm(kw)] ?? 0), 0)
      : 0;
    return {
      month: d.month,
      count: d.keywords.length,
      value: hasVolume ? volume : d.keywords.length,
      keywords: d.keywords.join(", "),
    };
  });

  const metricLabel = hasVolume ? "volume" : "keyword";

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
            labelFormatter={(label) => String(label)}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as {
                month: string;
                keywords: string;
                value: number;
              };
              return (
                <div className="bg-popover border-border rounded-lg border p-2 text-xs shadow-md">
                  <p className="font-medium">{row.month}</p>
                  <p className="text-muted-foreground">
                    {hasVolume
                      ? `${row.value.toLocaleString("id-ID")} pencarian/bln`
                      : `${row.value} keyword peak`}
                  </p>
                  <p className="text-muted-foreground mt-1 max-w-48">{row.keywords}</p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="value"
            name={metricLabel}
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
