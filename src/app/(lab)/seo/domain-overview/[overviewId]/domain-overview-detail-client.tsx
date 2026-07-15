"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  Swords,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { lab } from "@/components/lab/lab-primitives";
import { SEO_STATUS_LABELS, isSeoStatusBusy } from "@/lib/seo/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { actionErrorMessage } from "@/lib/action-error-message";
import { refreshSeoDomainOverview } from "@/actions/seo-domain-overview";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/lab/echart";
import type {
  CompetitorDomain,
  DomainHistoryPoint,
  DomainRankOverview,
  RankedKeyword,
} from "@/lib/seo/dataforseo/labs-domain";
import { cn } from "@/lib/utils";

export type DomainOverviewDetail = {
  id: string;
  target: string;
  status: SeoAnalysisStatus;
  overview: DomainRankOverview | null;
  topKeywords: RankedKeyword[];
  competitors: CompetitorDomain[];
  history: DomainHistoryPoint[];
  dataNotice: string | null;
  errorMessage: string | null;
};

type SortKey = "position" | "volume" | "etv" | "keyword";

const SORT_ITEMS: SelectItemDef[] = [
  { value: "position", label: "Posisi terbaik" },
  { value: "volume", label: "Volume tertinggi" },
  { value: "etv", label: "Trafik est. tertinggi" },
  { value: "keyword", label: "Abjad" },
];

const BUCKET_SEGMENTS = [
  { key: "pos1", label: "Posisi 1", dot: "bg-emerald-500" },
  { key: "pos2_3", label: "Posisi 2–3", dot: "bg-teal-500" },
  { key: "pos4_10", label: "Posisi 4–10", dot: "bg-sky-400" },
  { key: "pos11_20", label: "Posisi 11–20", dot: "bg-amber-400" },
  {
    key: "pos21_100",
    label: "Posisi 21–100",
    dot: "bg-slate-400 dark:bg-slate-500",
  },
] as const;

const compactNumber = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function num(v: number | null | undefined): string {
  return v == null ? "—" : v.toLocaleString("id-ID");
}

/** Badge posisi dengan tone per jenjang (top 3 → hijau, hal. 1 → teal, dst.). */
function PositionBadge({ position }: { position: number | null }) {
  if (position == null) return <span className="text-muted-foreground">—</span>;
  const tone =
    position <= 3
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : position <= 10
        ? "bg-teal-500/15 text-teal-700 dark:text-teal-300"
        : position <= 20
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : "bg-muted/70 text-foreground/80";
  return (
    <span
      className={cn(
        "inline-flex min-w-11 items-center justify-center rounded-lg px-2 py-1 text-sm font-bold tabular-nums",
        tone,
      )}
    >
      #{position}
    </span>
  );
}

/** Badge difficulty 0–100: <30 hijau (mudah), ≤60 amber, >60 rose. */
function DifficultyBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const tone =
    value < 30
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : value <= 60
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  return (
    <span
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded-lg px-2 py-1 text-xs font-bold tabular-nums",
        tone,
      )}
    >
      {value}
    </span>
  );
}

function StatusPill({ status }: { status: SeoAnalysisStatus }) {
  const busy = isSeoStatusBusy(status);
  const ready = status === SeoAnalysisStatus.READY;
  const failed = status === SeoAnalysisStatus.FAILED;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        ready && "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        busy && "bg-amber-500/12 text-amber-700 dark:text-amber-300",
        failed && "bg-rose-500/12 text-rose-700 dark:text-rose-300",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          ready && "bg-emerald-500",
          busy && "animate-pulse bg-amber-500",
          failed && "bg-rose-500",
        )}
      />
      {SEO_STATUS_LABELS[status]}
    </span>
  );
}

export function DomainOverviewDetailClient({
  detail,
}: {
  detail: DomainOverviewDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("position");

  const historyOption: EChartsOption | null =
    detail.history.length >= 3
      ? {
          tooltip: { trigger: "axis" },
          legend: { top: 0 },
          grid: { left: 56, right: 48, top: 32, bottom: 28 },
          xAxis: {
            type: "category",
            data: detail.history.map((h) => h.month),
          },
          yAxis: [
            { type: "value", name: "Trafik" },
            { type: "value", name: "Keyword", splitLine: { show: false } },
          ],
          series: [
            {
              name: "Estimasi trafik",
              type: "line",
              smooth: true,
              showSymbol: false,
              areaStyle: { opacity: 0.12 },
              data: detail.history.map((h) => h.organicTraffic),
            },
            {
              name: "Keyword organik",
              type: "line",
              smooth: true,
              showSymbol: false,
              yAxisIndex: 1,
              data: detail.history.map((h) => h.organicKeywords),
            },
          ],
        }
      : null;

  const busy = isSeoStatusBusy(detail.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [busy, router]);

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshSeoDomainOverview(detail.id);
        toast.success("Analisis ulang dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      }
    });
  }

  const buckets = detail.overview?.posBuckets;
  const bucketTotal = buckets
    ? Math.max(
        buckets.pos1 +
          buckets.pos2_3 +
          buckets.pos4_10 +
          buckets.pos11_20 +
          buckets.pos21_100,
        1,
      )
    : 1;

  /* --------------------------- Tabel: filter + sortir --------------------------- */
  const visibleKeywords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = detail.topKeywords.filter(
      (k) =>
        !q ||
        k.keyword.toLowerCase().includes(q) ||
        (k.url ?? "").toLowerCase().includes(q),
    );
    const sorted = [...list];
    switch (sortBy) {
      case "position":
        sorted.sort((a, b) => (a.position ?? 101) - (b.position ?? 101));
        break;
      case "volume":
        sorted.sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1));
        break;
      case "etv":
        sorted.sort((a, b) => (b.etv ?? -1) - (a.etv ?? -1));
        break;
      case "keyword":
        sorted.sort((a, b) => a.keyword.localeCompare(b.keyword, "id"));
        break;
    }
    return sorted.slice(0, 50);
  }, [detail.topKeywords, query, sortBy]);

  return (
    <SeoDetailPage
      icon={Globe}
      backHref="/seo/domain-overview"
      title={detail.target}
      description="Domain Overview — data organik Google Indonesia (DataForSEO Labs)"
      right={
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={detail.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || busy}
          >
            <RefreshCw />
            Refresh
          </Button>
          <Button
            size="sm"
            render={
              <Link
                href={`/seo/keyword-gap?target=${encodeURIComponent(detail.target)}`}
              />
            }
          >
            <Swords />
            Keyword Gap
          </Button>
        </div>
      }
    >
      {detail.status === SeoAnalysisStatus.FAILED && detail.errorMessage ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-4 text-sm">
          {detail.errorMessage}
        </div>
      ) : null}
      {detail.dataNotice ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
          {detail.dataNotice}
        </div>
      ) : null}

      {busy ? (
        <div
          className={cn(lab.card, "flex items-center justify-center gap-3 p-10")}
        >
          <Loader2 className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">
            Menarik data Labs (overview, top keywords, kompetitor)…
          </p>
        </div>
      ) : (
        <>
          {/* Papan bento: trafik, distribusi posisi, keyword organik & paid */}
          <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4">
            {/* Estimasi trafik — tile hero teal */}
            <div className="bento-tile col-span-2 row-span-2 border-transparent bg-teal-600 shadow-md shadow-teal-600/20 lg:col-span-1 dark:bg-teal-500">
              <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
                Estimasi trafik organik
              </span>
              <span className="bento-value text-5xl text-white dark:text-teal-950">
                {detail.overview?.organicTraffic != null
                  ? compactNumber.format(detail.overview.organicTraffic)
                  : "—"}
                <span className="text-2xl font-bold text-teal-200/80 dark:text-teal-900/60">
                  /bln
                </span>
              </span>
              <span className="text-[11px] font-medium leading-snug text-teal-100/90 dark:text-teal-900/80">
                estimasi klik dari posisi organik · Google Indonesia
              </span>
            </div>

            {/* Distribusi posisi */}
            <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
              <div className="flex items-center justify-between">
                <span className="bento-label">Distribusi posisi</span>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {num(detail.overview?.organicKeywords)} keyword
                </span>
              </div>
              {buckets ? (
                <>
                  <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
                    {BUCKET_SEGMENTS.map((s) => {
                      const count = buckets[s.key];
                      if (count === 0) return null;
                      return (
                        <div
                          key={s.key}
                          className={s.dot}
                          style={{ width: `${(count / bucketTotal) * 100}%` }}
                          title={`${s.label}: ${num(count)}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {BUCKET_SEGMENTS.map((s) => {
                      const count = buckets[s.key];
                      return (
                        <div
                          key={s.key}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              s.dot,
                            )}
                            aria-hidden
                          />
                          <span className="text-muted-foreground flex-1">
                            {s.label}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {num(count)}
                          </span>
                          <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                            {Math.round((count / bucketTotal) * 100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Belum ada data distribusi posisi untuk domain ini.
                </p>
              )}
            </div>

            {/* Keyword organik */}
            <div className="bento-tile">
              <span className="bento-label">Keyword organik</span>
              <span className="bento-value">
                {num(detail.overview?.organicKeywords)}
              </span>
              <span className="text-muted-foreground text-[11px] font-medium">
                ranking di top 100
              </span>
            </div>

            {/* Keyword paid */}
            <div className="bento-tile">
              <span className="bento-label">Keyword iklan (paid)</span>
              <span className="bento-value">
                {num(detail.overview?.paidKeywords)}
              </span>
              <span className="text-muted-foreground text-[11px] font-medium">
                tampil sebagai iklan Google
              </span>
            </div>
          </div>

          {/* Tren organik */}
          {historyOption ? (
            <div className="bento-tile justify-start gap-2">
              <div className="flex items-center justify-between">
                <span className="bento-label">Tren organik</span>
                <span className="text-muted-foreground text-[11px]">
                  {detail.history.length} bulan terakhir
                </span>
              </div>
              <EChart option={historyOption} height={240} />
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
            {/* Top keywords */}
            <div className={cn(lab.card, "h-fit p-0")}>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-foreground font-bold tracking-tight">
                    Top keyword organik
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {visibleKeywords.length === detail.topKeywords.length
                      ? `${detail.topKeywords.length} keyword`
                      : `${visibleKeywords.length} dari ${detail.topKeywords.length} keyword`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cari keyword…"
                      className="h-9 w-48 pl-8 text-xs"
                    />
                  </div>
                  <Select
                    value={sortBy}
                    items={SORT_ITEMS}
                    onValueChange={(v) => {
                      if (v) setSortBy(v as SortKey);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      Urutkan:{" "}
                      {SORT_ITEMS.find((i) => i.value === sortBy)?.label ?? ""}
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_ITEMS.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {visibleKeywords.length === 0 ? (
                <p className="text-muted-foreground p-4 pt-0 text-sm">
                  {detail.topKeywords.length === 0
                    ? "Tidak ada data."
                    : `Tidak ada keyword yang cocok dengan pencarian “${query}”.`}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-right">Posisi</TableHead>
                        <TableHead className="text-right">Vol</TableHead>
                        <TableHead className="text-right">KD</TableHead>
                        <TableHead className="text-right">
                          Trafik est.
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleKeywords.map((k) => (
                        <TableRow key={k.keyword}>
                          <TableCell className="font-medium">
                            {k.keyword}
                            {k.url ? (
                              <a
                                href={k.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground block max-w-72 truncate text-xs hover:underline"
                              >
                                {k.url.replace(/^https?:\/\//, "")}
                              </a>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            <PositionBadge position={k.position} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {num(k.searchVolume)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DifficultyBadge value={k.difficulty} />
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {num(k.etv)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Kompetitor terdeteksi */}
            <div className="bento-tile h-fit justify-start gap-3">
              <div>
                <span className="bento-label">Kompetitor organik</span>
                <p className="text-muted-foreground mt-1 text-xs">
                  Terdeteksi otomatis dari keyword yang sama-sama di-ranking —
                  klik untuk Keyword Gap.
                </p>
              </div>
              {detail.competitors.length === 0 ? (
                <p className="text-muted-foreground text-sm">Tidak ada data.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {detail.competitors.slice(0, 8).map((c) => (
                    <Link
                      key={c.domain}
                      href={`/seo/keyword-gap?target=${encodeURIComponent(detail.target)}&competitor=${encodeURIComponent(c.domain)}`}
                      className={cn(
                        lab.nestedPanel,
                        "hover:border-primary/40 flex items-center gap-2 text-sm transition-colors",
                      )}
                      title="Buat Keyword Gap vs domain ini"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold tracking-tight">
                          {c.domain}
                        </span>
                        <span className="text-muted-foreground block text-xs tabular-nums">
                          {num(c.intersections)} keyword beririsan · avg pos{" "}
                          {c.avgPosition ?? "—"}
                        </span>
                      </span>
                      <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </SeoDetailPage>
  );
}
