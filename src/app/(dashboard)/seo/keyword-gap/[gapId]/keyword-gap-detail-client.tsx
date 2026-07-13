"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Search,
  Swords,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EChart } from "@/components/research-hub/echart";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { SeoGapVenn } from "@/components/seo/seo-gap-venn";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { isSeoStatusBusy, formatRankPosition } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  comparePagesAction,
  refreshSeoKeywordGap,
  sendGapKeywordsToResearch,
} from "@/actions/seo-keyword-gap";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageIntersectionRow } from "@/lib/seo/dataforseo/labs-domain";
import type {
  GapBucket,
  GapRow,
  GapSummary,
} from "@/lib/seo/keyword-gap/gap-logic";
import { cn } from "@/lib/utils";

export type KeywordGapDetail = {
  id: string;
  name: string;
  target: string;
  competitors: string[];
  status: SeoAnalysisStatus;
  rows: GapRow[];
  summary: GapSummary | null;
  dataNotice: string | null;
  errorMessage: string | null;
};

const BUCKET_LABELS: Record<GapBucket, string> = {
  missing: "Missing",
  weak: "Weak",
  strong: "Strong",
  shared: "Shared",
  untapped: "Untapped",
};

const BUCKET_HINTS: Record<GapBucket, string> = {
  missing: "Kompetitor ranking, Anda tidak — peluang konten baru.",
  weak: "Anda ranking di bawah semua kompetitor — optimasi konten.",
  strong: "Anda unggul dari semua kompetitor.",
  shared: "Sama-sama ranking, posisi campuran.",
  untapped: "Baru satu kompetitor yang menggarap — celah cepat.",
};

const BUCKET_COLORS: Record<GapBucket, string> = {
  missing: "#ef4444",
  weak: "#f59e0b",
  strong: "#22c55e",
  shared: "#6366f1",
  untapped: "#06b6d4",
};

function num(v: number | null | undefined): string {
  return v == null ? "—" : v.toLocaleString("id-ID");
}

export function KeywordGapDetailClient({ detail }: { detail: KeywordGapDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bucket, setBucket] = useState<GapBucket | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageOwn, setPageOwn] = useState("");
  const [pageComp, setPageComp] = useState("");
  const [pageRows, setPageRows] = useState<PageIntersectionRow[] | null>(null);
  const [comparing, setComparing] = useState(false);

  const busy = isSeoStatusBusy(detail.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [busy, router]);

  const visible = useMemo(
    () =>
      bucket === "all"
        ? detail.rows
        : detail.rows.filter((r) => r.bucket === bucket),
    [detail.rows, bucket],
  );

  const scatterOption = useMemo<EChartsOption | null>(() => {
    const points = detail.rows.filter(
      (r) => r.searchVolume != null && r.difficulty != null,
    );
    if (points.length < 3) return null;
    const buckets = [...new Set(points.map((p) => p.bucket))];
    return {
      tooltip: {
        formatter: (p) => {
          const d = (p as unknown as { data: [number, number, string] }).data;
          return `${d[2]}<br/>Vol ${d[0].toLocaleString("id-ID")} · KD ${d[1]}`;
        },
      },
      legend: { top: 0 },
      grid: { left: 48, right: 16, top: 32, bottom: 40 },
      xAxis: { type: "log", name: "Volume", nameLocation: "middle", nameGap: 26, min: 1 },
      yAxis: { type: "value", name: "Difficulty", max: 100 },
      series: buckets.map((b) => ({
        name: BUCKET_LABELS[b],
        type: "scatter" as const,
        symbolSize: 9,
        itemStyle: { color: BUCKET_COLORS[b], opacity: 0.75 },
        data: points
          .filter((p) => p.bucket === b)
          .map((p) => [p.searchVolume!, p.difficulty!, p.keyword]),
      })),
    };
  }, [detail.rows]);

  function toggleSelect(keyword: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshSeoKeywordGap(detail.id);
        toast.success("Analisis ulang dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      }
    });
  }

  function handleComparePages() {
    if (!pageOwn.trim() || !pageComp.trim()) {
      toast.error("Isi kedua URL dulu.");
      return;
    }
    setComparing(true);
    startTransition(async () => {
      try {
        const { rows } = await comparePagesAction({
          page1: pageOwn.trim(),
          page2: pageComp.trim(),
        });
        setPageRows(rows);
        if (rows.length === 0) {
          toast.info("Tidak ada data keyword untuk kedua URL ini.");
        }
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membandingkan halaman."));
      } finally {
        setComparing(false);
      }
    });
  }

  function handleSendToResearch() {
    const keywords = [...selected];
    if (keywords.length === 0) {
      toast.error("Pilih keyword dulu (centang di tabel).");
      return;
    }
    startTransition(async () => {
      try {
        const { projectId } = await sendGapKeywordsToResearch({
          gapId: detail.id,
          keywords,
          projectName: `Gap: ${detail.name}`,
        });
        toast.success(`${keywords.length} keyword dikirim ke Keyword Research.`);
        router.push(`/seo/keyword-research/${projectId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengirim keyword."));
      }
    });
  }

  const summary = detail.summary;

  return (
    <SeoDetailPage
      icon={Swords}
      title={detail.name}
      description={`${detail.target} vs ${detail.competitors.join(", ")}`}
      right={
        <div className="flex items-center gap-2">
          <SeoStatusBadge status={detail.status} />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={pending || busy}>
            <RefreshCw />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleSendToResearch}
            disabled={pending || selected.size === 0}
          >
            <Search />
            Kirim ke Keyword Research ({selected.size})
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/seo/keyword-gap" />}>
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
            Membandingkan keyword organik per kompetitor…
          </p>
        </div>
      ) : (
        <>
          {summary ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <div className={cn(hub.card, "p-4")}>
                <p className="mb-3 font-semibold">Irisan keyword</p>
                <SeoGapVenn
                  target={detail.target}
                  targetCount={summary.domainCounts.target ?? 0}
                  competitors={detail.competitors.map((c) => ({
                    domain: c,
                    count: summary.domainCounts[c] ?? 0,
                  }))}
                />
                <p className="text-muted-foreground text-xs">
                  {summary.sharedWithAnyCompetitor} keyword sama-sama di-ranking
                  Anda & minimal satu kompetitor (dari {summary.totalKeywords}{" "}
                  total).
                </p>
              </div>
              {scatterOption ? (
                <div className={cn(hub.card, "p-4")}>
                  <p className="mb-3 font-semibold">Peta peluang (vol × difficulty)</p>
                  <EChart option={scatterOption} height={260} />
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Filter bucket */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant={bucket === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setBucket("all")}
            >
              Semua ({detail.rows.length})
            </Button>
            {(Object.keys(BUCKET_LABELS) as GapBucket[]).map((b) => (
              <Button
                key={b}
                variant={bucket === b ? "default" : "outline"}
                size="sm"
                onClick={() => setBucket(b)}
                title={BUCKET_HINTS[b]}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: BUCKET_COLORS[b] }}
                />
                {BUCKET_LABELS[b]} ({summary?.buckets[b] ?? 0})
              </Button>
            ))}
          </div>

          {/* Tabel gap */}
          <div className={cn(hub.card, "overflow-x-auto p-4")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Keyword</TableHead>
                  <TableHead className="text-right">Vol</TableHead>
                  <TableHead className="text-right">KD</TableHead>
                  <TableHead className="text-right">Anda</TableHead>
                  {detail.competitors.map((c) => (
                    <TableHead key={c} className="text-right" title={c}>
                      <span className="block max-w-28 truncate">{c}</span>
                    </TableHead>
                  ))}
                  <TableHead>Bucket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.slice(0, 200).map((row) => (
                  <TableRow key={row.keyword}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.keyword)}
                        onCheckedChange={() => toggleSelect(row.keyword)}
                        aria-label={`Pilih ${row.keyword}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{row.keyword}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(row.searchVolume)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.difficulty ?? "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        row.targetPos == null && "text-muted-foreground font-normal",
                      )}
                    >
                      {formatRankPosition(row.targetPos)}
                    </TableCell>
                    {detail.competitors.map((c) => (
                      <TableCell
                        key={c}
                        className="text-muted-foreground text-right text-xs tabular-nums"
                      >
                        {formatRankPosition(row.competitorPos[c] ?? null)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="gap-1.5"
                        title={BUCKET_HINTS[row.bucket]}
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: BUCKET_COLORS[row.bucket] }}
                        />
                        {BUCKET_LABELS[row.bucket]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visible.length > 200 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Menampilkan 200 dari {visible.length} baris — persempit dengan
                filter bucket.
              </p>
            ) : null}
          </div>

          {/* Bedah halaman vs halaman (page intersection) */}
          <div className={cn(hub.card, "p-4")}>
            <p className="mb-1 font-semibold">Bedah halaman vs halaman</p>
            <p className="text-muted-foreground mb-3 text-xs">
              Bandingkan satu URL Anda dengan satu URL kompetitor — lihat
              keyword yang mereka ranking tapi halaman Anda lewatkan.
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label>URL halaman Anda</Label>
                <Input
                  value={pageOwn}
                  onChange={(e) => setPageOwn(e.target.value)}
                  placeholder={`https://${detail.target}/blog/…`}
                  disabled={comparing}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>URL halaman kompetitor</Label>
                <Input
                  value={pageComp}
                  onChange={(e) => setPageComp(e.target.value)}
                  placeholder={`https://${detail.competitors[0] ?? "kompetitor.com"}/…`}
                  disabled={comparing}
                />
              </div>
              <Button onClick={handleComparePages} disabled={comparing || pending}>
                {comparing ? <Loader2 className="animate-spin" /> : <Search />}
                Bandingkan
              </Button>
            </div>

            {pageRows && pageRows.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead className="text-right">Vol</TableHead>
                      <TableHead className="text-right">Halaman Anda</TableHead>
                      <TableHead className="text-right">Kompetitor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.slice(0, 100).map((row) => {
                      const missed =
                        row.page1Position == null && row.page2Position != null;
                      return (
                        <TableRow key={row.keyword}>
                          <TableCell
                            className={cn(
                              "font-medium",
                              missed && "text-red-600 dark:text-red-400",
                            )}
                          >
                            {row.keyword}
                            {missed ? " ⚠" : ""}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {num(row.searchVolume)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatRankPosition(row.page1Position)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatRankPosition(row.page2Position)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        </>
      )}
    </SeoDetailPage>
  );
}
