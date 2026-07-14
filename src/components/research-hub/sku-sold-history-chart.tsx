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
    return (
      <div className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
        <p>Total terjual: {point.historicalSold?.toLocaleString("id-ID") ?? "—"}</p>
        <p>Bulan ini: {point.monthlySold?.toLocaleString("id-ID") ?? "—"}</p>
        <p>Revenue: {formatRevenueIdr(point.estimatedRevenue)}</p>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend />
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
