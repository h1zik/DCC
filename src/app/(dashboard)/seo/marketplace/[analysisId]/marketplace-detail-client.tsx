"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResearchMarketplace, SeoAnalysisStatus } from "@prisma/client";
import { ArrowLeft, RefreshCw, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import {
  ResearchHubEmptyState,
  ResearchHubStatChip,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { isSeoStatusBusy, scoreToneClass } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import { refreshSeoMarketplaceAnalysis } from "@/actions/seo-marketplace";
import { MARKETPLACE_LABELS } from "../marketplace-client";
import { cn } from "@/lib/utils";

type Listing = {
  name: string;
  price: number | null;
  soldCount: number | null;
  rating: number | null;
  isOfficialShop: boolean;
};

export type MarketplaceDetail = {
  id: string;
  keyword: string;
  marketplace: ResearchMarketplace;
  ownTitle: string | null;
  status: SeoAnalysisStatus;
  optimizationScore: number | null;
  listingStats: Record<string, unknown> | null;
  titlePatterns: { term: string; count: number }[];
  topListings: Listing[];
  recommendations: {
    titleScore?: {
      hasKeyword?: boolean;
      lengthOk?: boolean;
      coveredTerms?: string[];
      missingTerms?: string[];
    } | null;
    recommendations?: string[];
    improvedTitle?: string | null;
  } | null;
  dataNotice: string | null;
  errorMessage: string | null;
};

function num(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString("id-ID") : "—";
}

function rupiah(value: unknown): string {
  return typeof value === "number" ? `Rp${value.toLocaleString("id-ID")}` : "—";
}

export function MarketplaceDetailClient({
  analysis,
}: {
  analysis: MarketplaceDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const busy = isSeoStatusBusy(analysis.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [busy, router]);

  function handleRefresh() {
    setRefreshing(true);
    startTransition(async () => {
      try {
        await refreshSeoMarketplaceAnalysis(analysis.id);
        toast.success("Analisis ulang dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      } finally {
        setRefreshing(false);
      }
    });
  }

  const s = analysis.listingStats ?? {};
  const recs = analysis.recommendations;

  return (
    <SeoDetailPage
      icon={Store}
      title={analysis.keyword}
      description={`${MARKETPLACE_LABELS[analysis.marketplace] ?? analysis.marketplace} · marketplace SEO`}
      right={
        <div className="flex items-center gap-2">
          <SeoStatusBadge status={analysis.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || refreshing || busy}
          >
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            Ulang
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/seo/marketplace" />}>
            <ArrowLeft />
            Kembali
          </Button>
        </div>
      }
    >
      {analysis.status === SeoAnalysisStatus.FAILED && analysis.errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {analysis.errorMessage}
        </div>
      ) : null}
      {analysis.dataNotice ? (
        <div className={cn(hub.nestedPanel, "text-muted-foreground text-sm")}>
          {analysis.dataNotice}
        </div>
      ) : null}

      {busy ? (
        <ResearchHubEmptyState
          icon={Store}
          title="Menganalisis listing…"
          description="Scraping listing teratas dari marketplace. Halaman ter-update otomatis."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-3">
            <ResearchHubStatChip label="Listing" value={num(s.count)} tone="primary" />
            <ResearchHubStatChip label="Harga median" value={rupiah(s.medianPrice)} />
            <ResearchHubStatChip label="Rating rata-rata" value={num(s.avgRating)} tone="success" />
            <ResearchHubStatChip label="Total terjual" value={num(s.totalSold)} />
            <ResearchHubStatChip
              label="Official shop"
              value={
                typeof s.officialShopRate === "number"
                  ? `${Math.round(s.officialShopRate * 100)}%`
                  : "—"
              }
            />
            <ResearchHubStatChip label="Panjang judul" value={num(s.avgTitleLength)} />
          </div>

          {/* Skor judul sendiri */}
          {analysis.ownTitle ? (
            <div className={hub.panel}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    "text-3xl font-bold tabular-nums",
                    scoreToneClass(analysis.optimizationScore),
                  )}
                >
                  {analysis.optimizationScore ?? "—"}
                </span>
                <div>
                  <p className="font-semibold">Skor optimasi judul</p>
                  <p className="text-muted-foreground text-xs">{analysis.ownTitle}</p>
                </div>
              </div>
              {recs?.titleScore?.missingTerms && recs.titleScore.missingTerms.length > 0 ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Istilah penting yang belum ada: </span>
                  {recs.titleScore.missingTerms.map((t) => (
                    <Badge key={t} variant="outline" className="mr-1">
                      {t}
                    </Badge>
                  ))}
                </p>
              ) : null}
              {recs?.improvedTitle ? (
                <p className="mt-2 text-sm">
                  <span className="font-medium">Usulan judul: </span>
                  {recs.improvedTitle}
                </p>
              ) : null}
            </div>
          ) : null}

          {recs?.recommendations && recs.recommendations.length > 0 ? (
            <div className={hub.panel}>
              <p className={cn(hub.label, "mb-2")}>Rekomendasi</p>
              <ul className="text-muted-foreground ml-4 list-disc text-sm">
                {recs.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div className={cn(hub.card, "h-fit p-4")}>
              <p className="mb-2 font-semibold">Pola judul tersering</p>
              {analysis.titlePatterns.length === 0 ? (
                <p className="text-muted-foreground text-sm">—</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.titlePatterns.map((t) => (
                    <span
                      key={t.term}
                      className="rounded-md border border-border/50 bg-muted/40 px-2 py-0.5 text-xs"
                    >
                      {t.term}{" "}
                      <span className="text-muted-foreground">×{t.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className={cn(hub.card, "overflow-x-auto p-4")}>
              <p className="mb-3 font-semibold">Listing teratas</p>
              {analysis.topListings.length === 0 ? (
                <p className="text-muted-foreground text-sm">Belum ada data.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Terjual</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.topListings.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="max-w-[360px] truncate text-sm">
                          {l.isOfficialShop ? "⭐ " : ""}
                          {l.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {rupiah(l.price)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {num(l.soldCount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {num(l.rating)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      )}
    </SeoDetailPage>
  );
}
