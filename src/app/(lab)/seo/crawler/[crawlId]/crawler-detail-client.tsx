"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus, SeoIssueSeverity } from "@prisma/client";
import { ArrowLeft, Bug, Gauge, RefreshCw, Search } from "lucide-react";
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
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import {
  LabEmptyState,
  LabStatChip,
  lab,
} from "@/components/lab/lab-primitives";
import {
  SEO_SEVERITY_LABELS,
  isSeoStatusBusy,
  scoreToneClass,
} from "@/lib/seo/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { actionErrorMessage } from "@/lib/action-error-message";
import { refreshSeoSiteCrawl } from "@/actions/seo-crawler";
import { useSeoCrawlPolling } from "@/hooks/use-seo-crawl-polling";
import { cn } from "@/lib/utils";
import {
  CrawlPageInventory,
  type CrawlPageInventoryRow,
} from "./crawl-page-inventory";

export type CrawlIssueRow = {
  id: string;
  type: string;
  severity: SeoIssueSeverity;
  count: number;
  url: string | null;
  message: string;
};

export type CrawlDetail = {
  id: string;
  name: string;
  domain: string;
  status: SeoAnalysisStatus;
  pagesCrawled: number;
  maxPages: number;
  includeLighthouse: boolean;
  summary: Record<string, unknown> | null;
  lighthouse: {
    performanceScore?: number | null;
    lcp?: string | null;
    cls?: string | null;
    tbt?: string | null;
    fcp?: string | null;
    speedIndex?: string | null;
  } | null;
  healthScore: number | null;
  issueDiff: {
    new: number;
    fixed: number;
    persisting: number;
    newIssues: { type: string; url: string | null; severity: string; message: string }[];
    fixedIssues: { type: string; url: string | null; severity: string; message: string }[];
  } | null;
  healthHistory: { date: string; score: number; current: boolean }[];
  dataNotice: string | null;
  errorMessage: string | null;
  issues: CrawlIssueRow[];
  pages: CrawlPageInventoryRow[];
};

function metric(obj: unknown, key: string): number | null {
  if (!obj || typeof obj !== "object") return null;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "number" ? v : null;
}

/* ------------------------- Severity: tone & distribusi ------------------------ */

const SEVERITY_ORDER: SeoIssueSeverity[] = [
  SeoIssueSeverity.CRITICAL,
  SeoIssueSeverity.HIGH,
  SeoIssueSeverity.MEDIUM,
  SeoIssueSeverity.LOW,
  SeoIssueSeverity.INFO,
];

/** Badge tinted per severity: error → rose, warning → amber, notice → muted. */
const SEVERITY_TONE: Record<SeoIssueSeverity, string> = {
  CRITICAL: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  HIGH: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  MEDIUM: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  LOW: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  INFO: "bg-muted text-muted-foreground",
};

const SEVERITY_DOT: Record<SeoIssueSeverity, string> = {
  CRITICAL: "bg-rose-600",
  HIGH: "bg-rose-400",
  MEDIUM: "bg-amber-400",
  LOW: "bg-slate-400 dark:bg-slate-500",
  INFO: "bg-muted-foreground/25",
};

function SeverityBadge({ severity }: { severity: SeoIssueSeverity }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg px-2 py-1 text-[11px] font-bold",
        SEVERITY_TONE[severity],
      )}
    >
      {SEO_SEVERITY_LABELS[severity]}
    </span>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "text-foreground mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight",
          tone,
        )}
      >
        {value}
      </p>
    </div>
  );
}

type PerPageSort = "severity" | "url";

const PER_PAGE_SORT_ITEMS: SelectItemDef[] = [
  { value: "severity", label: "Severity tertinggi" },
  { value: "url", label: "URL (abjad)" },
];

export function CrawlerDetailClient({ crawl }: { crawl: CrawlDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<PerPageSort>("severity");

  const busy = isSeoStatusBusy(crawl.status);
  useSeoCrawlPolling(busy ? [crawl.id] : []);

  const pm = (crawl.summary?.pageMetrics as Record<string, unknown> | undefined) ?? null;

  const { aggregate, perPage } = useMemo(() => {
    return {
      aggregate: crawl.issues.filter((i) => !i.url),
      perPage: crawl.issues.filter((i) => i.url),
    };
  }, [crawl.issues]);

  const severityCounts = useMemo(() => {
    const counts = Object.fromEntries(
      SEVERITY_ORDER.map((s) => [s, 0]),
    ) as Record<SeoIssueSeverity, number>;
    for (const i of crawl.issues) counts[i.severity] += 1;
    return counts;
  }, [crawl.issues]);

  const visiblePerPage = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = perPage.filter(
      (i) =>
        !q ||
        (i.url ?? "").toLowerCase().includes(q) ||
        i.message.toLowerCase().includes(q),
    );
    const sorted = [...list];
    if (sortBy === "severity") {
      sorted.sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.severity) -
          SEVERITY_ORDER.indexOf(b.severity),
      );
    } else {
      sorted.sort((a, b) => (a.url ?? "").localeCompare(b.url ?? "", "id"));
    }
    return sorted;
  }, [perPage, query, sortBy]);

  function handleRefresh() {
    setRefreshing(true);
    startTransition(async () => {
      try {
        await refreshSeoSiteCrawl(crawl.id);
        toast.success("Crawl ulang dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      } finally {
        setRefreshing(false);
      }
    });
  }

  const lh = crawl.lighthouse;
  const distTotal = crawl.issues.length || 1;

  return (
    <SeoDetailPage
      icon={Bug}
      title={crawl.name}
      description={`${crawl.domain} · ${crawl.pagesCrawled}/${crawl.maxPages} halaman · ${crawl.issues.length} isu`}
      right={
        <div className="flex items-center gap-2">
          <SeoStatusBadge status={crawl.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || refreshing || busy}
          >
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            Crawl ulang
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/seo/crawler" />}>
            <ArrowLeft />
            Kembali
          </Button>
        </div>
      }
    >
      {crawl.status === SeoAnalysisStatus.FAILED && crawl.errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {crawl.errorMessage}
        </div>
      ) : null}
      {crawl.dataNotice ? (
        <div className={cn(lab.nestedPanel, "text-muted-foreground text-sm")}>
          {crawl.dataNotice}
        </div>
      ) : null}

      {busy ? (
        <LabEmptyState
          icon={Bug}
          title="Crawl berjalan…"
          description={`Telah meng-crawl ${crawl.pagesCrawled} halaman. Halaman ter-update otomatis saat selesai.`}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Papan bento: health score + distribusi isu + stat */}
          <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4">
            {/* Health score — tile hero teal */}
            <div className="bento-tile col-span-2 row-span-2 border-transparent bg-teal-600 shadow-md shadow-teal-600/20 lg:col-span-1 dark:bg-teal-500">
              <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
                Health score
              </span>
              <span className="bento-value text-5xl text-white dark:text-teal-950">
                {crawl.healthScore ?? "—"}
                <span className="text-2xl font-bold text-teal-200/80 dark:text-teal-900/60">
                  /100
                </span>
              </span>
              {crawl.healthHistory.length >= 2 ? (
                <div className="flex items-end gap-1">
                  {crawl.healthHistory.map((h) => (
                    <div
                      key={h.date + String(h.current)}
                      className={cn(
                        "w-4 rounded-t",
                        h.current
                          ? "bg-white/90 dark:bg-teal-950/90"
                          : "bg-white/30 dark:bg-teal-950/30",
                      )}
                      style={{ height: `${Math.max(6, h.score * 0.4)}px` }}
                      title={`${h.date}: ${h.score}`}
                    />
                  ))}
                </div>
              ) : null}
              <span className="text-[11px] font-medium leading-snug text-teal-100/90 dark:text-teal-900/80">
                {crawl.healthHistory.length >= 2
                  ? `tren ${crawl.healthHistory.length} crawl untuk ${crawl.domain}`
                  : "tren muncul setelah beberapa crawl domain ini"}
              </span>
            </div>

            {/* Distribusi isu per severity */}
            <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
              <div className="flex items-center justify-between">
                <span className="bento-label">Distribusi isu</span>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {crawl.issues.length} isu
                </span>
              </div>
              <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
                {SEVERITY_ORDER.map((s) => {
                  const count = severityCounts[s];
                  if (count === 0) return null;
                  return (
                    <div
                      key={s}
                      className={SEVERITY_DOT[s]}
                      style={{ width: `${(count / distTotal) * 100}%` }}
                      title={`${SEO_SEVERITY_LABELS[s]}: ${count}`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-col gap-1.5">
                {SEVERITY_ORDER.map((s) => {
                  const count = severityCounts[s];
                  return (
                    <div key={s} className="flex items-center gap-2 text-xs">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          SEVERITY_DOT[s],
                        )}
                        aria-hidden
                      />
                      <span className="text-muted-foreground flex-1">
                        {SEO_SEVERITY_LABELS[s]}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {count}
                      </span>
                      <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                        {Math.round((count / distTotal) * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Halaman dicrawl */}
            <div className="bento-tile">
              <span className="bento-label">Halaman dicrawl</span>
              <span className="bento-value">
                {crawl.pagesCrawled}
                <span className="text-muted-foreground/60 text-lg font-bold">
                  {" "}
                  / {crawl.maxPages}
                </span>
              </span>
            </div>

            {/* Isu error vs warning */}
            <div className="bento-tile">
              <span className="bento-label">Kritis · Peringatan</span>
              <span className="flex items-baseline gap-3">
                <span className="bento-value text-2xl text-rose-600 dark:text-rose-400">
                  {severityCounts.CRITICAL + severityCounts.HIGH}
                </span>
                <span className="bento-value text-2xl text-amber-600 dark:text-amber-400">
                  {severityCounts.MEDIUM}
                </span>
              </span>
            </div>
          </div>

          {/* Diff vs crawl sebelumnya + metrik halaman */}
          <div className="grid gap-3 lg:grid-cols-2">
            {crawl.issueDiff ? (
              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">Vs crawl sebelumnya</span>
                <div className="flex flex-wrap gap-3">
                  <LabStatChip
                    label="Isu baru"
                    value={crawl.issueDiff.new}
                    tone={crawl.issueDiff.new > 0 ? "warning" : undefined}
                  />
                  <LabStatChip
                    label="Diperbaiki"
                    value={crawl.issueDiff.fixed}
                    tone="success"
                  />
                  <LabStatChip label="Tetap" value={crawl.issueDiff.persisting} />
                </div>
                {crawl.issueDiff.newIssues.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Isu baru:
                    </p>
                    <ul className="text-muted-foreground ml-4 list-disc text-xs">
                      {crawl.issueDiff.newIssues.slice(0, 6).map((i, idx) => (
                        <li key={idx}>
                          [{i.severity}] {i.message}
                          {i.url ? ` — ${i.url}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {crawl.issueDiff.fixedIssues.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Diperbaiki:
                    </p>
                    <ul className="text-muted-foreground ml-4 list-disc text-xs">
                      {crawl.issueDiff.fixedIssues.slice(0, 4).map((i, idx) => (
                        <li key={idx}>
                          {i.message}
                          {i.url ? ` — ${i.url}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">Vs crawl sebelumnya</span>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Diff isu muncul mulai crawl kedua untuk domain & jumlah
                  halaman yang sama.
                </p>
              </div>
            )}

            {/* Metrik halaman */}
            {pm ? (
              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">Metrik halaman</span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <MiniStat
                    label="On-Page score"
                    value={metric(pm, "onpageScore") ?? "—"}
                  />
                  <MiniStat
                    label="Link internal"
                    value={metric(pm, "linksInternal") ?? "—"}
                  />
                  <MiniStat
                    label="Link eksternal"
                    value={metric(pm, "linksExternal") ?? "—"}
                  />
                  <MiniStat
                    label="Broken link"
                    value={metric(pm, "brokenLinks") ?? 0}
                    tone={
                      (metric(pm, "brokenLinks") ?? 0) > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : undefined
                    }
                  />
                  <MiniStat
                    label="Title duplikat"
                    value={metric(pm, "duplicateTitle") ?? 0}
                    tone={
                      (metric(pm, "duplicateTitle") ?? 0) > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : undefined
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Core Web Vitals */}
          {lh ? (
            <div className="bento-tile justify-start gap-3">
              <div className="flex items-center justify-between">
                <span className="bento-label inline-flex items-center gap-1.5">
                  <Gauge className="size-3.5" aria-hidden />
                  Core Web Vitals (Lighthouse)
                </span>
                {lh.performanceScore != null ? (
                  <span
                    className={cn(
                      "bento-value text-2xl",
                      scoreToneClass(lh.performanceScore),
                    )}
                  >
                    {lh.performanceScore}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["LCP", lh.lcp],
                  ["CLS", lh.cls],
                  ["TBT", lh.tbt],
                  ["FCP", lh.fcp],
                  ["Speed Index", lh.speedIndex],
                ].map(([label, value]) => (
                  <div key={label} className={cn(lab.nestedPanel, "text-center")}>
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                      {label}
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold tabular-nums tracking-tight">
                      {value ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <CrawlPageInventory
            pages={crawl.pages}
            issues={crawl.issues}
            domain={crawl.domain}
          />

          {/* Isu agregat (prioritas) */}
          <div className="bento-tile justify-start gap-3">
            <div className="flex items-center justify-between">
              <span className="bento-label">Isu prioritas</span>
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {aggregate.length} isu agregat
              </span>
            </div>
            {aggregate.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Tidak ada isu agregat. 🎉
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {aggregate.map((issue) => (
                  <li
                    key={issue.id}
                    className="flex items-center gap-2.5 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                  >
                    <SeverityBadge severity={issue.severity} />
                    <span className="min-w-0 flex-1 text-sm">
                      {issue.message}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {issue.count} hal.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Isu per-URL */}
          {perPage.length > 0 ? (
            <div id="page-issues" className={cn(lab.card, "scroll-mt-4 p-0")}>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-foreground font-bold tracking-tight">
                    Isu per-halaman
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {visiblePerPage.length === perPage.length
                      ? `${perPage.length} isu`
                      : `${visiblePerPage.length} dari ${perPage.length} isu`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cari URL atau isu…"
                      className="h-9 w-48 pl-8 text-xs"
                    />
                  </div>
                  <Select
                    value={sortBy}
                    items={PER_PAGE_SORT_ITEMS}
                    onValueChange={(v) => {
                      if (v) setSortBy(v as PerPageSort);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      Urutkan:{" "}
                      {PER_PAGE_SORT_ITEMS.find((i) => i.value === sortBy)
                        ?.label ?? ""}
                    </SelectTrigger>
                    <SelectContent>
                      {PER_PAGE_SORT_ITEMS.map((i) => (
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
                      <TableHead>URL</TableHead>
                      <TableHead>Isu</TableHead>
                      <TableHead className="text-right">Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiblePerPage.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="max-w-[420px] truncate text-xs">
                          {issue.url}
                        </TableCell>
                        <TableCell className="text-sm">
                          {issue.message}
                        </TableCell>
                        <TableCell className="text-right">
                          <SeverityBadge severity={issue.severity} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {visiblePerPage.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    Tidak ada isu yang cocok dengan pencarian.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </SeoDetailPage>
  );
}
