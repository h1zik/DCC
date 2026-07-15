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
import { formatRevenueIdr } from "@/lib/research/shop-product-metrics";
import type { SoldHistoryPoint } from "@/lib/research/shop-product-mappers";

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgb(30 25 15 / 0.25)",
} as const;

export function SkuSoldHistoryChart({ data }: { data: SoldHistoryPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada riwayat sold — refresh kompetitor beberapa kali untuk melihat trend.
      </p>
    );
  }

  const hasTrend = data.length >= 2;

  if (!hasTrend) {
    const point = data[0]!;
    const single = [
      { label: "Total terjual", value: point.historicalSold?.toLocaleString("id-ID") ?? "—" },
      { label: "Bulan ini", value: point.monthlySold?.toLocaleString("id-ID") ?? "—" },
      { label: "Revenue", value: formatRevenueIdr(point.estimatedRevenue) },
    ];
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {single.map((s) => (
          <div key={s.label} className="bg-muted/50 rounded-xl px-3.5 py-3">
            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
              {s.label}
            </p>
            <p className="text-foreground mt-0.5 truncate text-lg font-extrabold tabular-nums tracking-tight">
              {s.value}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            fontSize={10}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="historicalSold"
            name="Total terjual"
            stroke="var(--chart-1)"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="monthlySold"
            name="Bulan ini"
            stroke="var(--chart-5)"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
