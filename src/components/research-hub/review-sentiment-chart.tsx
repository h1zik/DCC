"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS = {
  positive: "var(--chart-4)",
  neutral: "var(--muted-foreground)",
  negative: "var(--destructive)",
};

export function ReviewSentimentChart({
  positivePct,
  neutralPct,
  negativePct,
}: {
  positivePct: number;
  neutralPct: number;
  negativePct: number;
}) {
  const data = [
    { name: "Positif", value: positivePct, fill: COLORS.positive },
    { name: "Netral", value: neutralPct, fill: COLORS.neutral },
    { name: "Negatif", value: negativePct, fill: COLORS.negative },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada data sentimen.</p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" ? `${value.toFixed(1)}%` : "—",
              String(name ?? ""),
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
        {data.map((d) => (
          <span key={d.name} className="inline-flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ background: d.fill }}
              aria-hidden
            />
            {d.name} {d.value.toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}
