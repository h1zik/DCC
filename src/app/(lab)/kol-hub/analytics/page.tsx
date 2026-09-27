import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import {
  ANALYTICS_DIMENSIONS,
  getKolAnalytics,
  periodRange,
  type AnalyticsDimension,
} from "@/lib/kol/analytics";
import { listBrandOptions } from "@/lib/kol/readers";
import { AnalyticsClient } from "./analytics-client";

export const metadata: Metadata = { title: "Analytics · KOL Hub" };

export default async function KolAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ by?: string; period?: string; brand?: string; platform?: string }>;
}) {
  const sp = await searchParams;
  const by = (ANALYTICS_DIMENSIONS as readonly string[]).includes(sp.by ?? "")
    ? (sp.by as AnalyticsDimension)
    : "kol";
  const range = periodRange(sp.period);
  const platform =
    sp.platform === "INSTAGRAM" || sp.platform === "TIKTOK"
      ? (sp.platform as "INSTAGRAM" | "TIKTOK")
      : null;

  const [data, brands] = await Promise.all([
    getKolAnalytics({ from: range.from, to: range.to, brandId: sp.brand || null, platform }, by),
    listBrandOptions(),
  ]);

  return (
    <LabModulePage
      icon={BarChart3}
      eyebrow="KOL Hub"
      title="Analytics"
      description={`Performa endorsement ${range.label}, dihitung dari jadwal bertanggal tayang di periode ini. Views & FYP hanya dari konten yang sudah tayang.`}
    >
      <AnalyticsClient
        data={data}
        by={by}
        periodKey={range.key}
        periodLabel={range.label}
        brands={brands}
      />
    </LabModulePage>
  );
}
