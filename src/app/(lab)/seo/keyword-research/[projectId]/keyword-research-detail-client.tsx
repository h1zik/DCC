"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus, SeoKeywordIntent } from "@prisma/client";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  RefreshCw,
  Search,
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
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import {
  SEO_INTENT_LABELS,
  SEO_STATUS_LABELS,
  isSeoStatusBusy,
} from "@/lib/seo/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { actionErrorMessage } from "@/lib/action-error-message";
import { refreshSeoKeywordProject } from "@/actions/seo-keyword-research";
import { cn } from "@/lib/utils";

export type KeywordRow = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  difficulty: number | null;
  intent: SeoKeywordIntent;
  clusterLabel: string | null;
  trend: "up" | "down" | "flat" | null;
  source: string | null;
};

type ProjectInfo = {
  id: string;
  name: string;
  seedKeyword: string;
  status: SeoAnalysisStatus;
  aiSummary: string | null;
  dataNotice: string | null;
  errorMessage: string | null;
};

type SortKey = "volume" | "difficulty" | "cpc" | "keyword";

const SORT_ITEMS: SelectItemDef[] = [
  { value: "volume", label: "Volume tertinggi" },
  { value: "difficulty", label: "Difficulty terendah" },
  { value: "cpc", label: "CPC tertinggi" },
  { value: "keyword", label: "Abjad" },
];

const INTENT_SEGMENTS: { key: SeoKeywordIntent; dot: string }[] = [
  { key: SeoKeywordIntent.TRANSACTIONAL, dot: "bg-emerald-500" },
  { key: SeoKeywordIntent.COMMERCIAL, dot: "bg-teal-500" },
  { key: SeoKeywordIntent.INFORMATIONAL, dot: "bg-amber-400" },
  { key: SeoKeywordIntent.NAVIGATIONAL, dot: "bg-violet-400" },
  { key: SeoKeywordIntent.UNKNOWN, dot: "bg-muted-foreground/25" },
];

/** Tone badge intent — selaras palet tinted rank-tracker. */
const INTENT_TONE: Record<SeoKeywordIntent, string> = {
  TRANSACTIONAL: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  COMMERCIAL: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  INFORMATIONAL: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  NAVIGATIONAL: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  UNKNOWN: "bg-muted/70 text-muted-foreground",
};

function difficultyTextClass(difficulty: number | null): string {
  if (difficulty == null) return "text-muted-foreground";
  if (difficulty < 30) return "text-emerald-600 dark:text-emerald-400";
  if (difficulty <= 60) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
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

function TrendIcon({ trend }: { trend: KeywordRow["trend"] }) {
  if (trend === "up")
    return (
      <ArrowUpRight className="size-3.5 text-emerald-500" aria-label="naik" />
    );
  if (trend === "down")
    return (
      <ArrowDownRight className="size-3.5 text-rose-500" aria-label="turun" />
    );
  return <Minus className="text-muted-foreground size-3.5" aria-label="stabil" />;
}

function formatNumber(value: number | null): string {
  return value == null ? "—" : value.toLocaleString("id-ID");
}

export function KeywordResearchDetailClient({
  project,
  keywords,
}: {
  project: ProjectInfo;
  keywords: KeywordRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyRefresh, setBusyRefresh] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("volume");

  const busy = isSeoStatusBusy(project.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [busy, router]);

  /* -------------------------------- Statistik hero ------------------------------- */
  const stats = useMemo(() => {
    const totalVolume = keywords.reduce(
      (s, k) => s + (k.searchVolume ?? 0),
      0,
    );
    const diffs = keywords
      .map((k) => k.difficulty)
      .filter((x): x is number => x != null);
    const avgDifficulty = diffs.length
      ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
      : null;
    const intentCounts = Object.fromEntries(
      Object.values(SeoKeywordIntent).map((i) => [i, 0]),
    ) as Record<SeoKeywordIntent, number>;
    for (const k of keywords) intentCounts[k.intent] += 1;
    const clusterCount = new Set(
      keywords.map((k) => k.clusterLabel || "Lainnya"),
    ).size;
    return { totalVolume, avgDifficulty, intentCounts, clusterCount };
  }, [keywords]);

  const intentTotal = keywords.length || 1;

  /* --------------------- Cluster: filter + sortir keyword --------------------- */
  const clusters = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = keywords.filter(
      (k) =>
        !q ||
        k.keyword.toLowerCase().includes(q) ||
        (k.clusterLabel ?? "").toLowerCase().includes(q),
    );
    const sorted = [...list];
    switch (sortBy) {
      case "volume":
        sorted.sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1));
        break;
      case "difficulty":
        sorted.sort((a, b) => (a.difficulty ?? 101) - (b.difficulty ?? 101));
        break;
      case "cpc":
        sorted.sort((a, b) => (b.cpc ?? -1) - (a.cpc ?? -1));
        break;
      case "keyword":
        sorted.sort((a, b) => a.keyword.localeCompare(b.keyword, "id"));
        break;
    }
    const map = new Map<string, KeywordRow[]>();
    for (const k of sorted) {
      const label = k.clusterLabel || "Lainnya";
      const rows = map.get(label) ?? [];
      rows.push(k);
      map.set(label, rows);
    }
    return [...map.entries()]
      .map(([label, rows]) => ({
        label,
        rows,
        totalVolume: rows.reduce((s, r) => s + (r.searchVolume ?? 0), 0),
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [keywords, query, sortBy]);

  const visibleCount = clusters.reduce((s, c) => s + c.rows.length, 0);

  function handleRefresh() {
    setBusyRefresh(true);
    startTransition(async () => {
      try {
        await refreshSeoKeywordProject(project.id);
        toast.success("Riset ulang dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      } finally {
        setBusyRefresh(false);
      }
    });
  }

  return (
    <SeoDetailPage
      icon={Search}
      backHref="/seo/keyword-research"
      title={project.name}
      description={`Seed: "${project.seedKeyword}" · ${keywords.length} keyword · ${stats.clusterCount} cluster`}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={project.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || busyRefresh || busy}
          >
            <RefreshCw className={cn(busyRefresh && "animate-spin")} />
            Riset ulang
          </Button>
        </div>
      }
    >
      {project.status === SeoAnalysisStatus.FAILED && project.errorMessage ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-4 text-sm">
          {project.errorMessage}
        </div>
      ) : null}

      {project.dataNotice ? (
        <div className={cn(lab.nestedPanel, "text-muted-foreground text-sm")}>
          {project.dataNotice}
        </div>
      ) : null}

      {/* Papan bento: total keyword, distribusi intent, volume, difficulty */}
      {keywords.length > 0 ? (
        <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Total keyword — tile hero teal */}
          <div className="bento-tile col-span-2 row-span-2 border-transparent bg-teal-600 shadow-md shadow-teal-600/20 lg:col-span-1 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Total keyword
            </span>
            <span className="bento-value text-5xl text-white dark:text-teal-950">
              {keywords.length.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium leading-snug text-teal-100/90 dark:text-teal-900/80">
              turunan seed “{project.seedKeyword}” · {stats.clusterCount}{" "}
              cluster tema
            </span>
          </div>

          {/* Distribusi intent */}
          <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
            <div className="flex items-center justify-between">
              <span className="bento-label">Distribusi intent</span>
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {keywords.length} keyword
              </span>
            </div>
            <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
              {INTENT_SEGMENTS.map((s) => {
                const count = stats.intentCounts[s.key];
                if (count === 0) return null;
                return (
                  <div
                    key={s.key}
                    className={s.dot}
                    style={{ width: `${(count / intentTotal) * 100}%` }}
                    title={`${SEO_INTENT_LABELS[s.key]}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5">
              {INTENT_SEGMENTS.map((s) => {
                const count = stats.intentCounts[s.key];
                return (
                  <div key={s.key} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", s.dot)}
                      aria-hidden
                    />
                    <span className="text-muted-foreground flex-1">
                      {SEO_INTENT_LABELS[s.key]}
                    </span>
                    <span className="font-semibold tabular-nums">{count}</span>
                    <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                      {Math.round((count / intentTotal) * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Volume total */}
          <div className="bento-tile">
            <span className="bento-label">Volume total</span>
            <span className="bento-value">
              {formatNumber(stats.totalVolume)}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              pencarian/bln (gabungan)
            </span>
          </div>

          {/* Difficulty rata-rata */}
          <div className="bento-tile">
            <span className="bento-label">Difficulty rata-rata</span>
            <span
              className={cn(
                "bento-value",
                difficultyTextClass(stats.avgDifficulty),
              )}
            >
              {stats.avgDifficulty ?? "—"}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              skala 0–100 · kecil = mudah
            </span>
          </div>
        </div>
      ) : null}

      {/* Ringkasan strategi */}
      {project.aiSummary ? (
        <div className="bento-tile justify-start gap-3">
          <span className="bento-label">Ringkasan strategi</span>
          <p className="text-sm leading-relaxed">{project.aiSummary}</p>
        </div>
      ) : null}

      {keywords.length === 0 ? (
        <LabEmptyState
          icon={Search}
          title={busy ? "Sedang meriset…" : "Belum ada keyword"}
          description={
            busy
              ? "Mengumpulkan keyword dari DataForSEO. Halaman akan ter-update otomatis."
              : "Belum ada keyword untuk proyek ini."
          }
        />
      ) : (
        <section className="flex flex-col gap-3">
          {/* Toolbar cluster: cari + sortir */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-foreground font-bold tracking-tight">
                Cluster keyword
              </p>
              <p className="text-muted-foreground text-xs">
                {visibleCount === keywords.length
                  ? `${clusters.length} cluster · ${keywords.length} keyword`
                  : `${visibleCount} dari ${keywords.length} keyword cocok`}
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

          {clusters.length === 0 ? (
            <div className="border-border/70 bg-card/40 text-muted-foreground rounded-2xl border border-dashed p-5 text-sm">
              Tidak ada keyword yang cocok dengan pencarian “{query}”.
            </div>
          ) : (
            clusters.map((cluster) => (
              <div key={cluster.label} className={cn(lab.card, "p-0")}>
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-3">
                  <p className="text-foreground font-bold tracking-tight">
                    {cluster.label}
                  </p>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {cluster.rows.length} keyword · vol{" "}
                    {formatNumber(cluster.totalVolume)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-right">Volume</TableHead>
                        <TableHead className="text-right">Difficulty</TableHead>
                        <TableHead className="text-right">Komp.</TableHead>
                        <TableHead className="text-right">CPC</TableHead>
                        <TableHead>Intent</TableHead>
                        <TableHead className="text-center">Tren</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cluster.rows.map((k) => (
                        <TableRow key={k.keyword}>
                          <TableCell className="font-medium">
                            {k.keyword}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatNumber(k.searchVolume)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DifficultyBadge value={k.difficulty} />
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                            {k.competition != null
                              ? `${Math.round(k.competition * 100)}%`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                            {k.cpc != null ? `$${k.cpc.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold",
                                INTENT_TONE[k.intent],
                              )}
                            >
                              {SEO_INTENT_LABELS[k.intent]}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex justify-center">
                              <TrendIcon trend={k.trend} />
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </SeoDetailPage>
  );
}
