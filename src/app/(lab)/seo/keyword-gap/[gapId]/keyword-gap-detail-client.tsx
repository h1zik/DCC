"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { SeoAnalysisStatus } from "@prisma/client";
import { Loader2, RefreshCw, Search, Swords } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { EChart } from "@/components/lab/echart";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { SeoGapVenn } from "@/components/seo/seo-gap-venn";
import { lab } from "@/components/lab/lab-primitives";
import { isSeoStatusBusy, formatRankPosition } from "@/lib/seo/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
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
  unique: "Unique",
  mixed: "Mixed",
};

const BUCKET_HINTS: Record<GapBucket, string> = {
  missing: "Semua kompetitor ranking, Anda tidak — peluang prioritas.",
  weak: "Anda ranking di bawah semua kompetitor — optimasi konten.",
  strong: "Anda unggul dari semua kompetitor.",
  shared: "Semua domain yang dibandingkan sama-sama ranking.",
  untapped: "Sebagian kompetitor ranking, Anda belum — peluang baru.",
  unique: "Hanya domain Anda yang ranking — kekuatan eksklusif.",
  mixed: "Anda dan sebagian kompetitor ranking dengan posisi campuran.",
};

const BUCKET_COLORS: Record<GapBucket, string> = {
  missing: "var(--destructive)",
  weak: "var(--chart-5)",
  strong: "var(--chart-4)",
  shared: "var(--chart-1)",
  untapped: "var(--chart-2)",
  unique: "var(--chart-3)",
  mixed: "var(--muted-foreground)",
};

/** Tone badge tinted per bucket (selaras dot di bawah). */
const BUCKET_TONES: Record<GapBucket, string> = {
  missing: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  weak: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  strong: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  shared: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  untapped: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  unique: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  mixed: "bg-muted/70 text-foreground/80",
};

/** Segmen bar distribusi bucket (urut prioritas peluang). */
const DIST_SEGMENTS: { key: GapBucket; dot: string }[] = [
  { key: "missing", dot: "bg-rose-500" },
  { key: "weak", dot: "bg-amber-400" },
  { key: "untapped", dot: "bg-violet-500" },
  { key: "shared", dot: "bg-teal-500" },
  { key: "strong", dot: "bg-emerald-500" },
  { key: "unique", dot: "bg-sky-500" },
  { key: "mixed", dot: "bg-slate-400 dark:bg-slate-500" },
];

type SortKey = "volume" | "difficulty" | "position" | "keyword";

const SORT_ITEMS: SelectItemDef[] = [
  { value: "volume", label: "Volume tertinggi" },
  { value: "difficulty", label: "KD terendah" },
  { value: "position", label: "Posisi Anda terbaik" },
  { value: "keyword", label: "Abjad" },
];

function num(v: number | null | undefined): string {
  return v == null ? "—" : v.toLocaleString("id-ID");
}

function BucketBadge({ bucket }: { bucket: GapBucket }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-bold",
        BUCKET_TONES[bucket],
      )}
      title={BUCKET_HINTS[bucket]}
    >
      {BUCKET_LABELS[bucket]}
    </span>
  );
}

/** Badge posisi domain Anda dengan tone per jenjang. */
function PositionBadge({ position }: { position: number | null }) {
  if (position == null) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
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

export function KeywordGapDetailClient({ detail }: { detail: KeywordGapDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bucket, setBucket] = useState<GapBucket | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageOwn, setPageOwn] = useState("");
  const [pageComp, setPageComp] = useState("");
  const [pageRows, setPageRows] = useState<PageIntersectionRow[] | null>(null);
  const [comparing, setComparing] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("volume");

  const busy = isSeoStatusBusy(detail.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [busy, router]);

  const visible = useMemo(() => {
    const byBucket =
      bucket === "all"
        ? detail.rows
        : detail.rows.filter((r) => (r.buckets ?? [r.bucket]).includes(bucket));
    const q = query.trim().toLowerCase();
    const filtered = q
      ? byBucket.filter((r) => r.keyword.toLowerCase().includes(q))
      : byBucket;
    const sorted = [...filtered];
    switch (sortBy) {
      case "volume":
        sorted.sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1));
        break;
      case "difficulty":
        sorted.sort((a, b) => (a.difficulty ?? 101) - (b.difficulty ?? 101));
        break;
      case "position":
        sorted.sort((a, b) => (a.targetPos ?? 101) - (b.targetPos ?? 101));
        break;
      case "keyword":
        sorted.sort((a, b) => a.keyword.localeCompare(b.keyword, "id"));
        break;
    }
    return sorted;
  }, [detail.rows, bucket, query, sortBy]);

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
        itemStyle: { opacity: 0.75 },
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
  const coverage = summary?.coverage;
  // Total penanda bucket (kategori tumpang tindih, jadi > total keyword).
  const bucketTagTotal = summary
    ? DIST_SEGMENTS.reduce((acc, s) => acc + (summary.buckets[s.key] ?? 0), 0) || 1
    : 1;

  return (
    <SeoDetailPage
      icon={Swords}
      backHref="/seo/keyword-gap"
      title={detail.name}
      description={`${detail.target} vs ${detail.competitors.join(", ")}`}
      right={
        <div className="flex flex-wrap items-center gap-2">
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
        <div className={cn(lab.card, "flex items-center justify-center gap-3 p-10")}>
          <Loader2 className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">
            Membandingkan keyword organik per kompetitor…
          </p>
        </div>
      ) : (
        <>
          {/* Papan bento: peluang, distribusi bucket, stat union */}
          {summary ? (
            <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4">
              {/* Missing — tile hero teal */}
              <div className="bento-tile col-span-2 row-span-2 border-transparent bg-teal-600 shadow-md shadow-teal-600/20 lg:col-span-1 dark:bg-teal-500">
                <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
                  Keyword missing
                </span>
                <span className="bento-value text-5xl text-white dark:text-teal-950">
                  {(summary.buckets.missing ?? 0).toLocaleString("id-ID")}
                </span>
                <span className="text-[11px] font-medium leading-snug text-teal-100/90 dark:text-teal-900/80">
                  semua kompetitor ranking, Anda belum — peluang prioritas
                </span>
              </div>

              {/* Distribusi bucket */}
              <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
                <div className="flex items-center justify-between">
                  <span className="bento-label">Distribusi bucket</span>
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {summary.totalKeywords.toLocaleString("id-ID")} keyword
                  </span>
                </div>
                <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
                  {DIST_SEGMENTS.map((s) => {
                    const count = summary.buckets[s.key] ?? 0;
                    if (count === 0) return null;
                    return (
                      <div
                        key={s.key}
                        className={s.dot}
                        style={{ width: `${(count / bucketTagTotal) * 100}%` }}
                        title={`${BUCKET_LABELS[s.key]}: ${count}`}
                      />
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {DIST_SEGMENTS.map((s) => {
                    const count = summary.buckets[s.key] ?? 0;
                    return (
                      <div
                        key={s.key}
                        className="flex items-center gap-2 text-xs"
                        title={BUCKET_HINTS[s.key]}
                      >
                        <span
                          className={cn("size-2 shrink-0 rounded-full", s.dot)}
                          aria-hidden
                        />
                        <span className="text-muted-foreground flex-1">
                          {BUCKET_LABELS[s.key]}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {count.toLocaleString("id-ID")}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-muted-foreground text-[10px] leading-snug">
                  Kategori dapat tumpang tindih — mis. keyword Weak juga
                  termasuk Shared.
                </p>
              </div>

              {/* Union sampel */}
              <div className="bento-tile">
                <span className="bento-label">Keyword union</span>
                <span className="bento-value">
                  {summary.totalKeywords.toLocaleString("id-ID")}
                </span>
                <span className="text-muted-foreground text-[11px] font-medium">
                  gabungan sampel semua domain
                </span>
              </div>

              {/* Overlap */}
              <div className="bento-tile">
                <span className="bento-label">Overlap kompetitor</span>
                <span className="bento-value">
                  {summary.sharedWithAnyCompetitor.toLocaleString("id-ID")}
                </span>
                <span className="text-muted-foreground text-[11px] font-medium">
                  Anda & minimal satu kompetitor sama-sama ranking
                </span>
              </div>
            </div>
          ) : null}

          {summary ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">Irisan keyword (ilustrasi)</span>
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
                  keyword dalam union sampel).
                </p>
              </div>
              {scatterOption ? (
                <div className="bento-tile justify-start gap-3">
                  <span className="bento-label">
                    Peta peluang (vol × difficulty)
                  </span>
                  <EChart option={scatterOption} height={260} />
                </div>
              ) : null}
            </div>
          ) : null}

          {coverage ? (
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {[detail.target, ...detail.competitors].map((domain) => (
                <span key={domain}>
                  {domain}: {coverage.fetchedByDomain[domain] ?? 0}/
                  {coverage.totalByDomain[domain] ?? 0} keyword
                  {coverage.truncatedDomains.includes(domain)
                    ? " (sampel teratas)"
                    : ""}
                </span>
              ))}
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
          <div className={cn(lab.card, "p-0")}>
            {/* Toolbar tabel */}
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-foreground font-bold tracking-tight">
                  Keyword gap
                </p>
                <p className="text-muted-foreground text-xs">
                  {visible.length === detail.rows.length
                    ? `${detail.rows.length} keyword`
                    : `${visible.length} dari ${detail.rows.length} keyword`}
                  {selected.size > 0 ? ` · ${selected.size} dipilih` : ""}
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

            <div className="overflow-x-auto">
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
                      <TableCell className="text-right">
                        <PositionBadge position={row.targetPos} />
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
                        <div className="flex flex-wrap gap-1">
                          {(row.buckets ?? [row.bucket]).map((rowBucket) => (
                            <BucketBadge key={rowBucket} bucket={rowBucket} />
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {visible.length > 200 ? (
              <p className="text-muted-foreground border-border/60 border-t p-3 text-xs">
                Menampilkan 200 dari {visible.length} baris — persempit dengan
                filter bucket atau pencarian.
              </p>
            ) : null}
          </div>

          {/* Bedah halaman vs halaman (page intersection) */}
          <div className="bento-tile justify-start gap-3">
            <div>
              <span className="bento-label">Bedah halaman vs halaman</span>
              <p className="text-muted-foreground mt-1 text-xs">
                Bandingkan satu URL Anda dengan satu URL kompetitor — lihat
                maksimal 200 keyword organik teratas yang mereka ranking tetapi
                halaman Anda lewatkan.
              </p>
            </div>
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
              <div className="overflow-x-auto">
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
