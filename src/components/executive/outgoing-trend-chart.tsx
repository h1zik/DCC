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
import {
  OUTGOING_CATEGORY_COLOR_VAR,
  OUTGOING_CATEGORY_LABELS,
  type OutgoingCategory,
  type OutgoingWeekPoint,
} from "@/lib/outgoing-metrics";

type Props = {
  data: OutgoingWeekPoint[];
  /** Urutan stack tetap dari server (bawah → atas). */
  categories: OutgoingCategory[];
};

type TooltipProps = {
  active?: boolean;
  payload?: { payload?: OutgoingWeekPoint }[];
  categories: OutgoingCategory[];
};

function WeekTooltip({ active, payload, categories }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="min-w-44 rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium">
        Minggu {point.label}
        {point.partial ? (
          <span className="font-normal text-muted-foreground"> (sebagian)</span>
        ) : null}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {categories.map((c) => (
          <li key={c} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                aria-hidden
                className="size-2 rounded-[2px]"
                style={{ background: OUTGOING_CATEGORY_COLOR_VAR[c] }}
              />
              {OUTGOING_CATEGORY_LABELS[c]}
            </span>
            <span className="font-mono tabular-nums">
              {point[c].toLocaleString("id-ID")}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex items-center justify-between gap-4 border-t border-border pt-1.5 text-xs font-medium">
        <span>Total</span>
        <span className="font-mono tabular-nums">
          {point.totalPcs.toLocaleString("id-ID")} PCS
        </span>
      </p>
    </div>
  );
}

/** Batang bertumpuk mingguan per kategori (dimuat client-only). */
export default function OutgoingTrendChart({ data, categories }: Props) {
  // Sudut membulat hanya di segmen teratas yang benar-benar ada per batang
  // tidak didukung murah oleh recharts; bulatkan seri teratas saja.
  const top = categories[categories.length - 1];
  const tickInterval = data.length > 14 ? Math.ceil(data.length / 9) - 1 : 0;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="var(--border)"
          />
          <XAxis
            dataKey="label"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            stroke="var(--muted-foreground)"
            tickFormatter={(v: number) => v.toLocaleString("id-ID")}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={<WeekTooltip categories={categories} />}
          />
          {categories.map((c) => (
            <Bar
              key={c}
              dataKey={c}
              stackId="out"
              name={OUTGOING_CATEGORY_LABELS[c]}
              fill={OUTGOING_CATEGORY_COLOR_VAR[c]}
              stroke="var(--card)"
              strokeWidth={1.5}
              radius={c === top ? [4, 4, 0, 0] : 0}
              maxBarSize={28}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
