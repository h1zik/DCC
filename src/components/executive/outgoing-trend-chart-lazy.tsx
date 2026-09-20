"use client";

import dynamic from "next/dynamic";

/** Recharts butuh DOM — muat client-only dengan placeholder setinggi chart. */
export const OutgoingTrendChartLazy = dynamic(
  () => import("./outgoing-trend-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-lg bg-muted/40" />
    ),
  },
);
