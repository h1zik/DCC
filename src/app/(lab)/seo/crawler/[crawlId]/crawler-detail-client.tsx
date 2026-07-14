"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus, SeoIssueSeverity } from "@prisma/client";
import { ArrowLeft, Bug, Gauge, RefreshCw } from "lucide-react";
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
  LabEmptyState,
  LabStatChip,
  lab,
} from "@/components/lab/lab-primitives";
import {
  SEO_SEVERITY_BADGE,
  SEO_SEVERITY_LABELS,
  isSeoStatusBusy,
  scoreToneClass,
} from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import { refreshSeoSiteCrawl } from "@/actions/seo-crawler";
import { cn } from "@/lib/utils";

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
};

function metric(obj: unknown, key: string): number | null {
  if (!obj || typeof obj !== "object") return null;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "number" ? v : null;
}

export function CrawlerDetailClient({ crawl }: { crawl: CrawlDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const busy = isSeoStatusBusy(crawl.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(timer);
  }, [busy, router]);

  const pm = (crawl.summary?.pageMetrics as Record<string, unknown> | undefined) ?? null;

  const { aggregate, perPage } = useMemo(() => {
    return {
      aggregate: crawl.issues.filter((i) => !i.url),
      perPage: crawl.issues.filter((i) => i.url),
    };
  }, [crawl.issues]);

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
          {/* Health + diff */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className={cn(lab.card, "p-4")}>
              <p className={cn(lab.label, "mb-1")}>Health score</p>
              <p
                className={cn(
                  "text-4xl font-bold tabular-nums",
                  scoreToneClass(crawl.healthScore),
                )}
              >
                {crawl.healthScore ?? "—"}
                <span className="text-muted-foreground text-lg font-normal">
                  /100
                </span>
              </p>
              {crawl.healthHistory.length >= 2 ? (
                <div className="mt-3 flex items-end gap-1">
                  {crawl.healthHistory.map((h) => (
                    <div
                      key={h.date + String(h.current)}
                      className={cn(
                        "w-4 rounded-t",
                        h.current ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                      style={{ height: `${Math.max(6, h.score * 0.5)}px` }}
                      title={`${h.date}: ${h.score}`}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground mt-2 text-xs">
                  Tren muncul setelah beberapa crawl untuk domain ini.
                </p>
              )}
            </div>

            {crawl.issueDiff ? (
              <div className={cn(lab.card, "p-4 lg:col-span-2")}>
                <p className={cn(lab.label, "mb-2")}>Vs crawl sebelumnya</p>
                <div className="mb-3 flex flex-wrap gap-3">
                  <LabStatChip
                    label="Isu baru"
                    value={crawl.issueDiff.new}
                    tone={crawl.issueDiff.new > 0 ? "warning" : undefined}
                  />
                  <LabStatChip label="Diperbaiki" value={crawl.issueDiff.fixed} tone="accent" />
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
                  <div className="mt-2">
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
              <div className={cn(lab.card, "text-muted-foreground p-4 text-sm lg:col-span-2")}>
                Diff isu muncul mulai crawl kedua untuk domain & jumlah halaman
                yang sama.
              </div>
            )}
          </div>

          {/* Ringkasan metrik */}
          {pm ? (
            <div className="flex flex-wrap gap-3">
              <LabStatChip
                label="On-Page score"
                value={metric(pm, "onpageScore") ?? "—"}
                tone="accent"
              />
              <LabStatChip label="Link internal" value={metric(pm, "linksInternal") ?? "—"} />
              <LabStatChip label="Link eksternal" value={metric(pm, "linksExternal") ?? "—"} />
              <LabStatChip
                label="Broken link"
                value={metric(pm, "brokenLinks") ?? 0}
                tone="warning"
              />
              <LabStatChip label="Title duplikat" value={metric(pm, "duplicateTitle") ?? 0} />
            </div>
          ) : null}

          {/* Core Web Vitals */}
          {lh ? (
            <div className={lab.panel}>
              <div className="mb-3 flex items-center gap-2">
                <Gauge className="size-4 text-primary" />
                <p className="font-semibold">Core Web Vitals (Lighthouse)</p>
                {lh.performanceScore != null ? (
                  <span
                    className={cn(
                      "ml-auto text-2xl font-bold tabular-nums",
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
                    <p className="text-muted-foreground text-[10px] uppercase">
                      {label}
                    </p>
                    <p className="text-sm font-semibold">{value ?? "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Isu agregat (prioritas) */}
          <div className={cn(lab.card, "p-4")}>
            <p className="mb-3 font-semibold">Isu (prioritas) — {aggregate.length}</p>
            {aggregate.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Tidak ada isu agregat. 🎉
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {aggregate.map((issue) => (
                  <li
                    key={issue.id}
                    className="flex items-center gap-2 border-b border-border/40 pb-2 last:border-0"
                  >
                    <Badge variant={SEO_SEVERITY_BADGE[issue.severity]}>
                      {SEO_SEVERITY_LABELS[issue.severity]}
                    </Badge>
                    <span className="min-w-0 flex-1 text-sm">{issue.message}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {issue.count} hal.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Isu per-URL */}
          {perPage.length > 0 ? (
            <div className={cn(lab.card, "overflow-x-auto p-4")}>
              <p className="mb-3 font-semibold">Isu per-halaman ({perPage.length})</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Isu</TableHead>
                    <TableHead className="text-right">Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perPage.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell className="max-w-[420px] truncate text-xs">
                        {issue.url}
                      </TableCell>
                      <TableCell className="text-sm">{issue.message}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={SEO_SEVERITY_BADGE[issue.severity]}>
                          {SEO_SEVERITY_LABELS[issue.severity]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      )}
    </SeoDetailPage>
  );
}
