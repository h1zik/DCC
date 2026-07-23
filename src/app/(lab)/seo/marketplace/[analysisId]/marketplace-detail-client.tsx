"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResearchMarketplace, SeoAnalysisStatus } from "@prisma/client";
import { ArrowLeft, RefreshCw, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { isSeoStatusBusy, scoreToneClass } from "@/lib/seo/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
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

type ListingSortKey = "default" | "sold" | "priceAsc" | "priceDesc" | "rating";

const LISTING_SORT_ITEMS: SelectItemDef[] = [
  { value: "default", label: "Urutan hasil" },
  { value: "sold", label: "Terjual terbanyak" },
  { value: "priceAsc", label: "Harga terendah" },
  { value: "priceDesc", label: "Harga tertinggi" },
  { value: "rating", label: "Rating tertinggi" },
];

function num(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString("id-ID") : "—";
}

function rupiah(value: unknown): string {
  return typeof value === "number" ? `Rp${value.toLocaleString("id-ID")}` : "—";
}

function statNum(
  stats: Record<string, unknown>,
  key: string,
): number | null {
  const v = stats[key];
  return typeof v === "number" ? v : null;
}

export function MarketplaceDetailClient({
  analysis,
}: {
  analysis: MarketplaceDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<ListingSortKey>("default");

  const busy = isSeoStatusBusy(analysis.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 5000);
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

  /* ------------------------------ Statistik hero ------------------------------ */
  const listingCount = statNum(s, "count");
  const officialRate = statNum(s, "officialShopRate");
  const officialCount =
    listingCount != null && officialRate != null
      ? Math.round(officialRate * listingCount)
      : null;
  const regularCount =
    listingCount != null && officialCount != null
      ? Math.max(listingCount - officialCount, 0)
      : null;

  /* --------------------------- Tabel: filter + sortir --------------------------- */
  const visibleListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = analysis.topListings.filter(
      (l) => !q || l.name.toLowerCase().includes(q),
    );
    const sorted = [...list];
    switch (sortBy) {
      case "sold":
        sorted.sort((a, b) => (b.soldCount ?? -1) - (a.soldCount ?? -1));
        break;
      case "priceAsc":
        sorted.sort(
          (a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER),
        );
        break;
      case "priceDesc":
        sorted.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
        break;
      case "rating":
        sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
        break;
      case "default":
        break;
    }
    return sorted;
  }, [analysis.topListings, query, sortBy]);

  const showScorePanel = !!analysis.ownTitle;
  const showRecsPanel = !!recs?.recommendations?.length;

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
        <div className={cn(lab.nestedPanel, "text-muted-foreground text-sm")}>
          {analysis.dataNotice}
        </div>
      ) : null}

      {busy ? (
        <LabEmptyState
          icon={Store}
          title="Menganalisis listing…"
          description="Scraping listing teratas dari marketplace. Halaman ter-update otomatis."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Papan bento: skor/listing + komposisi toko + statistik pasar */}
          <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4">
            {/* Tile hero teal */}
            <div className="bento-tile col-span-2 row-span-2 border-transparent bg-teal-600 shadow-md shadow-teal-600/20 lg:col-span-1 dark:bg-teal-500">
              <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
                {analysis.ownTitle ? "Skor optimasi judul" : "Listing dianalisis"}
              </span>
              <span className="bento-value text-5xl text-white dark:text-teal-950">
                {analysis.ownTitle
                  ? (analysis.optimizationScore ?? "—")
                  : num(listingCount)}
                {analysis.ownTitle ? (
                  <span className="text-2xl font-bold text-teal-200/80 dark:text-teal-900/60">
                    /100
                  </span>
                ) : null}
              </span>
              <span className="truncate text-[11px] font-medium leading-snug text-teal-100/90 dark:text-teal-900/80">
                {analysis.ownTitle ?? `keyword “${analysis.keyword}”`}
              </span>
            </div>

            {/* Komposisi toko (official vs reguler) */}
            {officialCount != null &&
            regularCount != null &&
            listingCount != null &&
            listingCount > 0 ? (
              <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
                <div className="flex items-center justify-between">
                  <span className="bento-label">Komposisi toko</span>
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {num(listingCount)} listing
                  </span>
                </div>
                <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
                  {officialCount > 0 ? (
                    <div
                      className="bg-teal-500"
                      style={{ width: `${(officialCount / listingCount) * 100}%` }}
                      title={`Official store: ${officialCount}`}
                    />
                  ) : null}
                  {regularCount > 0 ? (
                    <div
                      className="bg-muted-foreground/25"
                      style={{ width: `${(regularCount / listingCount) * 100}%` }}
                      title={`Toko reguler: ${regularCount}`}
                    />
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  {[
                    { label: "Official store", count: officialCount, dot: "bg-teal-500" },
                    {
                      label: "Toko reguler",
                      count: regularCount,
                      dot: "bg-muted-foreground/25",
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-2 text-xs">
                      <span
                        className={cn("size-2 shrink-0 rounded-full", row.dot)}
                        aria-hidden
                      />
                      <span className="text-muted-foreground flex-1">{row.label}</span>
                      <span className="font-semibold tabular-nums">{row.count}</span>
                      <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                        {Math.round((row.count / listingCount) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground mt-auto text-[11px] leading-snug">
                  Makin tinggi porsi official store, makin ketat persaingan
                  keyword ini.
                </p>
              </div>
            ) : null}

            <div className="bento-tile">
              <span className="bento-label">Harga median</span>
              <span className="bento-value text-2xl">{rupiah(s.medianPrice)}</span>
              <span className="text-muted-foreground text-[11px] font-medium">
                listing teratas
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Rating rata-rata</span>
              <span className="bento-value">{num(s.avgRating)}</span>
              <span className="text-muted-foreground text-[11px] font-medium">
                dari 5
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Total terjual</span>
              <span className="bento-value text-2xl">{num(s.totalSold)}</span>
              <span className="text-muted-foreground text-[11px] font-medium">
                akumulasi listing teratas
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Panjang judul</span>
              <span className="bento-value">{num(s.avgTitleLength)}</span>
              <span className="text-muted-foreground text-[11px] font-medium">
                karakter rata-rata
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Official shop</span>
              <span className="bento-value">
                {officialRate != null ? `${Math.round(officialRate * 100)}%` : "—"}
              </span>
              <span className="text-muted-foreground text-[11px] font-medium">
                porsi toko resmi
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Pola judul</span>
              <span className="bento-value">{analysis.titlePatterns.length}</span>
              <span className="text-muted-foreground text-[11px] font-medium">
                istilah dominan terdeteksi
              </span>
            </div>
          </div>

          {/* Skor judul sendiri + rekomendasi */}
          {showScorePanel || showRecsPanel ? (
            <div
              className={cn(
                "grid gap-3",
                showScorePanel && showRecsPanel && "lg:grid-cols-2",
              )}
            >
              {showScorePanel ? (
                <div className="bento-tile justify-start gap-3">
                  <span className="bento-label">Skor optimasi judul</span>
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "text-4xl font-extrabold tabular-nums tracking-tight",
                        scoreToneClass(analysis.optimizationScore),
                      )}
                    >
                      {analysis.optimizationScore ?? "—"}
                    </span>
                    <p className="text-muted-foreground min-w-0 text-sm leading-relaxed">
                      {analysis.ownTitle}
                    </p>
                  </div>
                  {recs?.titleScore ? (
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          "rounded-lg px-2 py-1 text-[11px] font-bold",
                          recs.titleScore.hasKeyword
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                        )}
                      >
                        {recs.titleScore.hasKeyword
                          ? "Keyword ada di judul"
                          : "Keyword belum ada di judul"}
                      </span>
                      <span
                        className={cn(
                          "rounded-lg px-2 py-1 text-[11px] font-bold",
                          recs.titleScore.lengthOk
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {recs.titleScore.lengthOk
                          ? "Panjang judul ideal"
                          : "Panjang judul belum ideal"}
                      </span>
                    </div>
                  ) : null}
                  {recs?.titleScore?.missingTerms &&
                  recs.titleScore.missingTerms.length > 0 ? (
                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1.5 text-xs">
                        Istilah penting yang belum ada:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {recs.titleScore.missingTerms.map((t) => (
                          <Badge key={t} variant="outline">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {recs?.improvedTitle ? (
                    <div className={cn(lab.nestedPanel, "mt-auto text-sm")}>
                      <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-wide">
                        Usulan judul
                      </p>
                      {recs.improvedTitle}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showRecsPanel ? (
                <div className="bento-tile justify-start gap-3">
                  <span className="bento-label">Rekomendasi</span>
                  <ul className="flex flex-col gap-2 text-sm leading-relaxed">
                    {recs?.recommendations?.map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <span
                          className="bg-primary/60 mt-1.5 size-1.5 shrink-0 rounded-full"
                          aria-hidden
                        />
                        <span className="text-muted-foreground">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Pola judul + tabel listing */}
          <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
            <div className="bento-tile h-fit justify-start gap-3">
              <span className="bento-label">Pola judul tersering</span>
              {analysis.titlePatterns.length === 0 ? (
                <p className="text-muted-foreground text-sm">—</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.titlePatterns.map((t) => (
                    <span
                      key={t.term}
                      className="bg-muted/60 rounded-lg px-2 py-1 text-xs font-medium"
                    >
                      {t.term}{" "}
                      <span className="text-muted-foreground tabular-nums">
                        ×{t.count}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className={cn(lab.card, "p-0")}>
              {/* Toolbar tabel */}
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-foreground font-bold tracking-tight">
                    Listing teratas
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {visibleListings.length === analysis.topListings.length
                      ? `${analysis.topListings.length} listing`
                      : `${visibleListings.length} dari ${analysis.topListings.length} listing`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cari produk…"
                      className="h-9 w-48 pl-8 text-xs"
                    />
                  </div>
                  <Select
                    value={sortBy}
                    items={LISTING_SORT_ITEMS}
                    onValueChange={(v) => {
                      if (v) setSortBy(v as ListingSortKey);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      Urutkan:{" "}
                      {LISTING_SORT_ITEMS.find((i) => i.value === sortBy)?.label ??
                        ""}
                    </SelectTrigger>
                    <SelectContent>
                      {LISTING_SORT_ITEMS.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {analysis.topListings.length === 0 ? (
                <p className="text-muted-foreground p-4 pt-0 text-sm">
                  Belum ada data.
                </p>
              ) : (
                <div className="overflow-x-auto">
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
                      {visibleListings.map((l, i) => (
                        <TableRow key={`${l.name}-${i}`}>
                          <TableCell className="max-w-[360px] text-sm">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate">{l.name}</span>
                              {l.isOfficialShop ? (
                                <span className="shrink-0 rounded bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300">
                                  Official
                                </span>
                              ) : null}
                            </span>
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </SeoDetailPage>
  );
}
