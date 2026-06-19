"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeasonalCurve } from "@/lib/research/keyword-intel/keyword-signal-types";

export type SeasonalMonth = {
  month: string;
  keywords: string[];
  event?: string;
};

const MONTH_ORDER = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function norm(keyword: string): string {
  return keyword.trim().toLowerCase();
}

export function SeasonalKeywordChart({
  data,
  volumeByKeyword,
  seasonalCurves,
}: {
  data: SeasonalMonth[];
  volumeByKeyword?: Record<string, number>;
  seasonalCurves?: SeasonalCurve[];
}) {
  if (seasonalCurves && seasonalCurves.length > 0) {
    const primary = seasonalCurves[0]!;
    const chartData = MONTH_ORDER.map((month) => {
      const point = primary.months.find((m) => m.month === month);
      return {
        month,
        value: point?.volume ?? point?.index ?? 0,
        source: primary.source,
      };
    });

    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          Kurva musiman nyata ({primary.source === "google_trends" ? "Google Trends" : "DataForSEO"}) —{" "}
          <strong>{primary.keyword}</strong>
        </p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {data.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Event overlay (AI):{" "}
            {data
              .filter((d) => d.keywords.length > 0)
              .slice(0, 4)
              .map((d) => `${d.month}${d.event ? ` (${d.event})` : ""}`)
              .join(", ")}
          </p>
        ) : null}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada data musiman.</p>
    );
  }

  const hasVolume =
    !!volumeByKeyword && Object.keys(volumeByKeyword).length > 0;

  const chartData = data.map((d) => {
    const volume = hasVolume
      ? d.keywords.reduce((sum, kw) => sum + (volumeByKeyword?.[norm(kw)] ?? 0), 0)
      : 0;
    return {
      month: d.month,
      count: d.keywords.length,
      value: hasVolume ? volume : d.keywords.length,
      keywords: d.keywords.join(", "),
    };
  });

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">
        Overlay event (estimasi keyword peak — bukan kurva volume nyata)
      </p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
