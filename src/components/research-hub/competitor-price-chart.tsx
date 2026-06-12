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
import { formatRp } from "@/lib/research/labels";

export function CompetitorPriceChart({
  data,
  skuNames,
  hasTrend = true,
}: {
  data: Record<string, string | number | null>[];
  skuNames: string[];
  hasTrend?: boolean;
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada data harga.</p>
    );
  }

  if (!hasTrend) {
    return (
      <p className="text-muted-foreground text-sm">
        Trend harga membutuhkan minimal 2 hari snapshot. Gunakan grafik
        &quot;Harga Saat Ini&quot; di atas untuk membandingkan SKU hari ini.
      </p>
    );
  }

  const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444"];

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
            tickFormatter={(v) =>
              typeof v === "number" ? `${Math.round(v / 1000)}rb` : ""
            }
          />
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" ? formatRp(value) : "—",
              String(name ?? ""),
            ]}
          />
          <Legend />
          {skuNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
