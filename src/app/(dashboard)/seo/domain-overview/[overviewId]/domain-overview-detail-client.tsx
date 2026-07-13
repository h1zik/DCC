"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Swords,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { hub } from "@/components/research-hub/research-hub-primitives";
import { isSeoStatusBusy, formatRankPosition } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import { refreshSeoDomainOverview } from "@/actions/seo-domain-overview";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/research-hub/echart";
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

function num(v: number | null | undefined): string {
  return v == null ? "—" : v.toLocaleString("id-ID");
}

export function DomainOverviewDetailClient({
  detail,
}: {
  detail: DomainOverviewDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
              itemStyle: { color: "#6366f1" },
              data: detail.history.map((h) => h.organicTraffic),
            },
            {
              name: "Keyword organik",
              type: "line",
              smooth: true,
              showSymbol: false,
              yAxisIndex: 1,
              itemStyle: { color: "#22c55e" },
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
  const bucketRows = buckets
    ? ([
        ["Posisi 1", buckets.pos1],
        ["Posisi 2–3", buckets.pos2_3],
        ["Posisi 4–10", buckets.pos4_10],
        ["Posisi 11–20", buckets.pos11_20],
        ["Posisi 21–100", buckets.pos21_100],
      ] as const)
    : [];
  const bucketMax = Math.max(...bucketRows.map(([, v]) => v), 1);

  return (
    <SeoDetailPage
      icon={Globe}
      title={detail.target}
      description="Domain Overview — data organik Google Indonesia (DataForSEO Labs)"
      right={
        <div className="flex items-center gap-2">
          <SeoStatusBadge status={detail.status} />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={pending || busy}>
            <RefreshCw />
            Refresh
          </Button>
          <Button
            variant="outline"
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
          <Button variant="ghost" size="sm" render={<Link href="/seo/domain-overview" />}>
            <ArrowLeft />
            Kembali
          </Button>
        </div>
      }
    >
      {detail.status === SeoAnalysisStatus.FAILED && detail.errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {detail.errorMessage}
        </div>
      ) : null}
      {detail.dataNotice ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
          {detail.dataNotice}
        </div>
      ) : null}

      {busy ? (
        <div className={cn(hub.card, "flex items-center justify-center gap-3 p-10")}>
          <Loader2 className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">
            Menarik data Labs (overview, top keywords, kompetitor)…
          </p>
        </div>
      ) : (
        <>
          {/* Kartu metrik */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={cn(hub.card, "p-4")}>
              <p className={cn(hub.label, "mb-1")}>Estimasi trafik organik</p>
              <p className="text-3xl font-bold tabular-nums">
                {num(detail.overview?.organicTraffic)}
                <span className="text-muted-foreground text-sm font-normal">
                  /bln
                </span>
              </p>
            </div>
            <div className={cn(hub.card, "p-4")}>
              <p className={cn(hub.label, "mb-1")}>Keyword organik</p>
              <p className="text-3xl font-bold tabular-nums">
                {num(detail.overview?.organicKeywords)}
              </p>
            </div>
            <div className={cn(hub.card, "p-4")}>
              <p className={cn(hub.label, "mb-1")}>Keyword iklan (paid)</p>
              <p className="text-3xl font-bold tabular-nums">
                {num(detail.overview?.paidKeywords)}
              </p>
            </div>
          </div>

          {historyOption ? (
            <div className={cn(hub.card, "p-4")}>
              <p className="mb-3 font-semibold">
                Tren organik ({detail.history.length} bulan terakhir)
              </p>
              <EChart option={historyOption} height={240} />
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-5">
              {/* Top keywords */}
              <div className={cn(hub.card, "overflow-x-auto p-4")}>
                <p className="mb-3 font-semibold">Top keyword organik</p>
                {detail.topKeywords.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Tidak ada data.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-right">Posisi</TableHead>
                        <TableHead className="text-right">Vol</TableHead>
                        <TableHead className="text-right">KD</TableHead>
                        <TableHead className="text-right">Trafik est.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.topKeywords.slice(0, 50).map((k) => (
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
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatRankPosition(k.position)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {num(k.searchVolume)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {k.difficulty ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {num(k.etv)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            <div className="flex h-fit flex-col gap-5">
              {/* Distribusi posisi */}
              {bucketRows.length > 0 ? (
                <div className={cn(hub.card, "p-4")}>
                  <p className="mb-3 font-semibold">Distribusi posisi</p>
                  <div className="flex flex-col gap-2 text-sm">
                    {bucketRows.map(([label, count]) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-muted-foreground w-24 shrink-0 text-xs">
                          {label}
                        </span>
                        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${(count / bucketMax) * 100}%` }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right text-xs tabular-nums">
                          {num(count)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Kompetitor terdeteksi */}
              <div className={cn(hub.card, "p-4")}>
                <p className="mb-1 font-semibold">Kompetitor organik</p>
                <p className="text-muted-foreground mb-3 text-xs">
                  Terdeteksi otomatis dari keyword yang sama-sama di-ranking.
                </p>
                {detail.competitors.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Tidak ada data.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.competitors.slice(0, 8).map((c) => (
                      <Link
                        key={c.domain}
                        href={`/seo/keyword-gap?target=${encodeURIComponent(detail.target)}&competitor=${encodeURIComponent(c.domain)}`}
                        className={cn(
                          hub.nestedPanel,
                          "flex items-center gap-2 text-sm hover:border-primary/40",
                        )}
                        title="Buat Keyword Gap vs domain ini"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {c.domain}
                          </span>
                          <span className="text-muted-foreground block text-xs">
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
          </div>
        </>
      )}
    </SeoDetailPage>
  );
}
