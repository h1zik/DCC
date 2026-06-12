"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

export type PositioningPoint = {
  name: string;
  brand: string;
  x: number;
  y: number;
};

export function PositioningScatterChart({
  axisX,
  axisY,
  points,
}: {
  axisX: string;
  axisY: string;
  points: PositioningPoint[];
}) {
  if (points.length === 0) return null;

  const data = points.map((p) => ({
    ...p,
    z: 80,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="x"
            name={axisX}
            domain={[0, 100]}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
            label={{
              value: axisX,
              position: "insideBottom",
              offset: -4,
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={axisY}
            domain={[0, 100]}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
            label={{
              value: axisY,
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
            }}
          />
          <ZAxis type="number" dataKey="z" range={[60, 200]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(value, name) => {
              if (typeof value === "number") return [value.toFixed(0), name];
              return [value, name];
            }}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as PositioningPoint | undefined;
              return p ? `${p.name} (${p.brand})` : "";
            }}
          />
          <Scatter
            name="Kompetitor"
            data={data}
            fill="var(--primary)"
            fillOpacity={0.75}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
