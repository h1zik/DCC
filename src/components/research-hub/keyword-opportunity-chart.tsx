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

export type OpportunityPoint = {
  keyword: string;
  volume: number;
  listingSampleCount: number;
  koiScore: number;
};

export function KeywordOpportunityChart({
  points,
}: {
  points: OpportunityPoint[];
}) {
  const data = points.filter(
    (p) => p.volume > 0 || (p.listingSampleCount ?? 0) > 0,
  );

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum cukup data volume/saturation untuk peta peluang.
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <p className="text-muted-foreground mb-2 text-xs">
        Sumbu X: volume Google · Y: sample listing Shopee (bukan total marketplace)
      </p>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="volume"
            name="Volume"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            dataKey="listingSampleCount"
            name="Sample listing"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis type="number" dataKey="koiScore" range={[40, 400]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const p = payload[0].payload as OpportunityPoint;
              return (
                <div className="bg-popover border-border rounded-lg border p-2 text-xs shadow-md">
                  <p className="font-medium">{p.keyword}</p>
                  <p>Vol {p.volume.toLocaleString("id-ID")}</p>
                  <p>Sample {p.listingSampleCount} listing</p>
                  <p>KOI {Math.round(p.koiScore * 100)}</p>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="var(--primary)" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
