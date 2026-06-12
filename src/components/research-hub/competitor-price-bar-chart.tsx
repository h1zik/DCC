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
import { formatRp } from "@/lib/research/labels";

export type PriceBarPoint = {
  name: string;
  price: number;
  hasPromo: boolean;
};

export function CompetitorPriceBarChart({ data }: { data: PriceBarPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada data harga.</p>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
            tickFormatter={(v) =>
              typeof v === "number" ? `${Math.round(v / 1000)}rb` : ""
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            fontSize={9}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            formatter={(value, _name, item) => {
              const promo = (item as { payload?: PriceBarPoint }).payload?.hasPromo;
              const label = typeof value === "number" ? formatRp(value) : "—";
              return [promo ? `${label} (promo)` : label, "Harga"];
            }}
          />
          <Bar
            dataKey="price"
            fill="#3b82f6"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
