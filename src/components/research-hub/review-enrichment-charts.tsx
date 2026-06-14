"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DONUT_COLORS = [
  "var(--chart-1, #ef4444)",
  "var(--chart-2, #22c55e)",
  "var(--chart-3, #3b82f6)",
  "var(--chart-4, #f59e0b)",
  "var(--chart-5, #8b5cf6)",
];

function severityColor(value: number): string {
  if (value >= 4) return "var(--chart-1, #ef4444)";
  if (value >= 3) return "var(--chart-4, #f59e0b)";
  return "var(--chart-3, #3b82f6)";
}

export function ComplaintSeverityChart({
  items,
}: {
  items: { theme: string; avgSeverity: number; count: number }[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada keluhan dengan tingkat keparahan terukur.
      </p>
    );
  }

  const data = items.slice(0, 8).map((i) => ({
    theme: i.theme.length > 22 ? `${i.theme.slice(0, 22)}…` : i.theme,
    severity: Number(i.avgSeverity.toFixed(2)),
    count: i.count,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 5]}
            tick={{ fontSize: 11 }}
            stroke="var(--border)"
          />
          <YAxis
            type="category"
            dataKey="theme"
            width={120}
            tick={{ fontSize: 11 }}
            stroke="var(--border)"
          />
          <Tooltip
            formatter={(value, name) =>
              name === "severity"
                ? [`${value} / 5`, "Keparahan"]
                : [value, name]
            }
          />
          <Bar dataKey="severity" radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell key={d.theme} fill={severityColor(d.severity)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DemographicDonut({
  title,
  items,
}: {
  title: string;
  items: { value: string; count: number }[];
}) {
  const data = items.slice(0, 5).map((i, idx) => ({
    name: i.value,
    value: i.count,
    fill: DONUT_COLORS[idx % DONUT_COLORS.length],
  }));

  if (data.length === 0) {
    return (
      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
          {title}
        </p>
        <p className="text-muted-foreground text-sm">Tidak terdeteksi.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
        {title}
      </p>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={34}
              outerRadius={58}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-2 text-[11px]">
        {data.map((d) => (
          <span key={d.name} className="inline-flex items-center gap-1 capitalize">
            <span
              className="size-2 rounded-full"
              style={{ background: d.fill }}
              aria-hidden
            />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  );
}
