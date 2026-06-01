"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface WeeklyChartProps {
  data: { label: string; hadir: number; absen: number }[];
}

/** Grafik batang kehadiran 7 hari terakhir (dimuat client-only). */
export default function AttendanceWeeklyChart({ data }: WeeklyChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              fontSize: "13px",
            }}
            formatter={(value, name) => [
              value,
              name === "hadir" ? "Hadir" : "Sakit/Izin",
            ]}
          />
          <Legend
            iconSize={10}
            formatter={(v) => (v === "hadir" ? "Hadir" : "Sakit/Izin")}
          />
          <Bar
            dataKey="hadir"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            dataKey="absen"
            fill="#f59e0b"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
