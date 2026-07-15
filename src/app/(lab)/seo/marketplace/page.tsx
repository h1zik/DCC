import { Store } from "lucide-react";
import { SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import {
  MarketplaceClient,
  type MarketplaceRow,
  type MarketplaceSummary,
} from "./marketplace-client";

export default async function SeoMarketplacePage() {
  const analyses = await prisma.seoMarketplaceAnalysis.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      keyword: true,
      marketplace: true,
      status: true,
      optimizationScore: true,
      ownTitle: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  const rows: MarketplaceRow[] = analyses.map((a) => ({
    id: a.id,
    keyword: a.keyword,
    marketplace: a.marketplace,
    status: a.status,
    optimizationScore: a.optimizationScore,
    hasOwnTitle: !!a.ownTitle,
    errorMessage: a.errorMessage,
    createdAt: a.createdAt.toISOString(),
  }));

  // Agregat ringkasan — dihitung dari data yang sudah diambil (tanpa query baru).
  const scores = analyses
    .map((a) => (a.ownTitle ? a.optimizationScore : null))
    .filter((s): s is number => s != null);
  const summary: MarketplaceSummary = {
    total: rows.length,
    ready: rows.filter((r) => r.status === SeoAnalysisStatus.READY).length,
    busy: rows.filter((r) => isSeoStatusBusy(r.status)).length,
    failed: rows.filter((r) => r.status === SeoAnalysisStatus.FAILED).length,
    avgScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
  };

  return (
    <SeoModulePage
      icon={Store}
      title="Marketplace SEO"
      description="Riset keyword marketplace (Shopee/Tokopedia/Lazada): analisis listing teratas (pola judul, harga, terjual, rating) + skor optimasi judul produk sendiri."
    >
      <MarketplaceClient analyses={rows} summary={summary} />
    </SeoModulePage>
  );
}
