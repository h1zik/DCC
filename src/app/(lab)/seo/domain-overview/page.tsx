import { Globe } from "lucide-react";
import { SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import {
  DomainOverviewClient,
  type DomainOverviewRow,
  type DomainPortfolioSummary,
} from "./domain-overview-client";

export default async function SeoDomainOverviewPage() {
  const rows = await prisma.seoDomainOverview.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      target: true,
      status: true,
      overview: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  const items: DomainOverviewRow[] = rows.map((r) => {
    const overview =
      r.overview && typeof r.overview === "object" && !Array.isArray(r.overview)
        ? (r.overview as { organicTraffic?: number; organicKeywords?: number })
        : null;
    return {
      id: r.id,
      target: r.target,
      status: r.status,
      organicTraffic: overview?.organicTraffic ?? null,
      organicKeywords: overview?.organicKeywords ?? null,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    };
  });

  // Agregat ringkasan — dihitung dari data yang sudah diambil, tanpa query baru.
  let topTraffic: DomainPortfolioSummary["topTraffic"] = null;
  let topKeywords: DomainPortfolioSummary["topKeywords"] = null;
  for (const item of items) {
    if (
      item.organicTraffic != null &&
      (!topTraffic || item.organicTraffic > topTraffic.value)
    ) {
      topTraffic = { target: item.target, value: item.organicTraffic };
    }
    if (
      item.organicKeywords != null &&
      (!topKeywords || item.organicKeywords > topKeywords.value)
    ) {
      topKeywords = { target: item.target, value: item.organicKeywords };
    }
  }
  const summary: DomainPortfolioSummary = {
    total: items.length,
    ready: items.filter((i) => i.status === SeoAnalysisStatus.READY).length,
    busy: items.filter((i) => isSeoStatusBusy(i.status)).length,
    topTraffic,
    topKeywords,
    latest: items[0]
      ? { target: items[0].target, createdAt: items[0].createdAt }
      : null,
  };

  return (
    <SeoModulePage
      icon={Globe}
      title="Domain Overview"
      description="Potret organik satu domain ala Semrush: estimasi trafik, jumlah keyword per posisi, top keywords, dan kompetitor organik yang terdeteksi otomatis."
    >
      <DomainOverviewClient items={items} summary={summary} />
    </SeoModulePage>
  );
}
