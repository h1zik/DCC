"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useTransition } from "react";
import {
  FileText,
  GitBranch,
  ListChecks,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { ResearchReportStatus } from "@prisma/client";
import { toast } from "sonner";
import { refreshResearchReport } from "@/actions/research-reports";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  ReportFeedbackSankey,
  type FeedbackLoopData,
} from "@/components/research-hub/report-feedback-sankey";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { ReportPdfDownloadButton } from "@/components/research-hub/report-pdf-download-button";
import {
  ReportSectionList,
  REPORT_BODY_HTML_CLASS,
  type ReportSectionRow,
} from "@/components/research-hub/report-section-list";
import { ReportShareLinkButton } from "@/components/research-hub/report-share-link-button";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { reportBodyToHtml } from "@/lib/research/reports/report-body-html";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RESEARCH_REPORT_STATUS_LABELS,
  RESEARCH_REPORT_TYPE_LABELS,
} from "@/lib/research/labels";
import { lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";

export type ReportActivityMetrics = {
  reviewSourcesReady: number;
  competitorsTracked: number;
  trendDigests: number;
  keywordQueries: number;
  socialBatches: number;
  uspAnalyses: number;
  productConcepts: number;
};

export type ReportDetailData = {
  id: string;
  title: string;
  type: string;
  status: ResearchReportStatus;
  aiSummary: string | null;
  sections: ReportSectionRow[];
  actionItems: {
    module: string;
    owner: string;
    priority: string;
    action: string;
    rationale: string;
    sourceLabel: string | null;
    href: string | null;
    /** Ada di laporan generasi baru; laporan lama tidak punya field ini. */
    evidence?: { label: string; refId?: string }[];
    confidence?: number;
    recommendationId?: string;
  }[];
  feedbackLoop: FeedbackLoopData | null;
  metrics: ReportActivityMetrics | null;
  periodStart: string | null;
  periodEnd: string | null;
  errorMessage: string | null;
  aiMeta: ResearchAiMetaView | null;
  sharePath: string;
  version: number;
  /** Jumlah versi lama yang diarsip (regenerate tidak menimpa riwayat). */
  revisionCount: number;
};

const PRIORITY_TONE: Record<string, string> = {
  P0: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  P1: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  P2: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

const METRIC_ROWS: { key: keyof ReportActivityMetrics; label: string }[] = [
  { key: "reviewSourcesReady", label: "Review siap" },
  { key: "competitorsTracked", label: "Kompetitor" },
  { key: "trendDigests", label: "Trend digest" },
  { key: "keywordQueries", label: "Keyword query" },
  { key: "socialBatches", label: "Social batch" },
  { key: "uspAnalyses", label: "USP analisis" },
  { key: "productConcepts", label: "Konsep" },
];

function statusPillTone(status: ResearchReportStatus): string {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "GENERATING":
    case "PENDING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-6 duration-200 motion-reduce:animate-none pt-4";

export function ReportDetailClient({ data }: { data: ReportDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inProgress =
    data.status === "GENERATING" || data.status === "PENDING";

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [inProgress, router]);

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshResearchReport(data.id);
        toast.success("Refresh dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      }
    });
  }

  const periodLabel =
    data.periodStart && data.periodEnd
      ? `${data.periodStart.slice(0, 10)} – ${data.periodEnd.slice(0, 10)}`
      : null;

  const maxMetric = useMemo(
    () =>
      data.metrics
        ? Math.max(...METRIC_ROWS.map((r) => data.metrics![r.key]), 1)
        : 1,
    [data.metrics],
  );

  const showHeroBoard =
    !inProgress &&
    (data.sections.length > 0 ||
      data.actionItems.length > 0 ||
      data.metrics != null);

  return (
    <ResearchHubDetailPage
      icon={FileText}
      backHref="/research-hub/research-reports"
      title={data.title}
      description={`${RESEARCH_REPORT_TYPE_LABELS[data.type as keyof typeof RESEARCH_REPORT_TYPE_LABELS] ?? data.type}${periodLabel ? ` · ${periodLabel}` : ""}`}
      right={
        <>
          <ResearchModelBadgeGroup meta={data.aiMeta} />
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
              statusPillTone(data.status),
            )}
          >
            {RESEARCH_REPORT_STATUS_LABELS[data.status]}
          </span>
          <ReportShareLinkButton path={data.sharePath} />
          {data.status === "READY" ? (
            <ReportPdfDownloadButton reportId={data.id} title={data.title} />
          ) : null}
          <Button
            size="sm"
            onClick={handleRefresh}
            disabled={pending || inProgress}
          >
            <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
            Refresh
          </Button>
        </>
      }
    >
      {inProgress ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="Generate laporan berjalan"
            percent={50}
            stepLabel="Mengagregasi modul riset & menulis section — halaman refresh otomatis."
          />
        </div>
      ) : null}

      {data.status === "FAILED" && data.errorMessage ? (
        <p
          className={cn(
            lab.entrance,
            "flex items-start gap-2.5 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-200",
          )}
          role="alert"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {data.errorMessage}
        </p>
      ) : null}

      {/* Papan hero bento */}
      {showHeroBoard ? (
        <div
          className={cn(
            lab.entrance,
            "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
          )}
        >
          <div className="bento-tile row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Rekomendasi aksi
            </span>
            <span className="bento-value text-5xl text-white dark:text-violet-950">
              {data.actionItems.length}
            </span>
            <span className="text-xs font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
              lintas-modul, deterministik dari pipeline riset
            </span>
          </div>

          {/* Aktivitas modul — tile lebar */}
          {data.metrics ? (
            <div className="bento-tile col-span-2 row-span-2 justify-start gap-2.5">
              <div className="flex items-center justify-between">
                <span className="bento-label">Aktivitas modul</span>
                <span className="text-muted-foreground text-[11px]">
                  volume sinyal dalam periode laporan
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {METRIC_ROWS.map((row) => {
                  const value = data.metrics![row.key];
                  return (
                    <div
                      key={row.key}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="text-muted-foreground w-24 shrink-0 truncate">
                        {row.label}
                      </span>
                      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full bg-violet-500/70 dark:bg-violet-400/70"
                          style={{ width: `${(value / maxMetric) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-semibold tabular-nums">
                        {value.toLocaleString("id-ID")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
              <span className="bento-label">Aktivitas modul</span>
              <p className="text-muted-foreground m-auto max-w-60 text-center text-sm">
                Metrik aktivitas modul belum tersedia untuk laporan ini.
              </p>
            </div>
          )}

          <div className="bento-tile">
            <span className="bento-label">Section laporan</span>
            <span className="bento-value">{data.sections.length}</span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Versi
            </span>
            <span className="bento-value text-violet-900 dark:text-violet-300">
              v{data.version}
            </span>
            <span className="text-[11px] font-medium text-violet-700/70 dark:text-violet-300/70">
              {data.revisionCount > 0
                ? `${data.revisionCount} versi diarsip`
                : "belum ada arsip revisi"}
            </span>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="ringkasan" className="gap-0">
        <div className={cn(lab.stickyToolbar, "pb-0")}>
          <TabsList variant="line" className="h-9 w-full justify-start gap-4">
            <TabsTrigger value="ringkasan" className="px-1">
              <Sparkles className="size-3.5" aria-hidden />
              Ringkasan
            </TabsTrigger>
            <TabsTrigger value="aksi" className="px-1">
              <ListChecks className="size-3.5" aria-hidden />
              Aksi
              {data.actionItems.length > 0 ? (
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {data.actionItems.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="alur" className="px-1">
              <GitBranch className="size-3.5" aria-hidden />
              Alur Riset
            </TabsTrigger>
            <TabsTrigger value="isi" className="px-1">
              <FileText className="size-3.5" aria-hidden />
              Isi
              {data.sections.length > 0 ? (
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {data.sections.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          {data.aiSummary ? (
            <div className="bento-tile justify-start gap-3">
              <span className="bento-label">Executive summary</span>
              <div
                className={REPORT_BODY_HTML_CLASS}
                dangerouslySetInnerHTML={{
                  __html: reportBodyToHtml(data.aiSummary),
                }}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Executive summary belum tersedia.
            </p>
          )}
        </TabsContent>

        <TabsContent value="aksi" className={tabContentClass}>
          {data.actionItems.length > 0 ? (
            <div className="flex flex-col gap-2">
              {data.actionItems.map((item, i) => {
                const body = (
                  <div
                    className={cn(
                      lab.card,
                      "flex items-start gap-3 p-4 transition-colors duration-150 motion-reduce:transition-none",
                      item.href && "hover:bg-muted/30",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold",
                        PRIORITY_TONE[item.priority] ??
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {item.priority}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tracking-tight">
                        {item.action}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                        {item.rationale}
                      </p>
                      {item.evidence && item.evidence.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {item.evidence.map((e, j) => (
                            <span
                              key={j}
                              className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]"
                            >
                              {e.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="text-muted-foreground mt-1.5 text-[10px] font-semibold uppercase tracking-wide">
                        {item.owner}
                        {item.sourceLabel ? ` · ${item.sourceLabel}` : ""}
                        {typeof item.confidence === "number"
                          ? ` · estimasi AI ${Math.round(item.confidence * 100)}%`
                          : ""}
                      </p>
                    </div>
                  </div>
                );
                return item.href ? (
                  <Link key={i} href={item.href} className="block">
                    {body}
                  </Link>
                ) : (
                  <div key={i}>{body}</div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Belum ada rekomendasi aksi.
            </p>
          )}
        </TabsContent>

        <TabsContent value="alur" className={tabContentClass}>
          {data.feedbackLoop ? (
            <div className="bento-tile justify-start gap-3">
              <div className="flex items-center justify-between">
                <span className="bento-label">Volume aktivitas riset</span>
                <span className="text-muted-foreground text-[11px]">
                  record nyata per modul dalam periode laporan
                </span>
              </div>
              <ReportFeedbackSankey data={data.feedbackLoop} />
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Bukan lineage per-item — hanya link USP → Konsep yang merupakan
                relasi langsung.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Data alur riset belum tersedia.
            </p>
          )}
        </TabsContent>

        <TabsContent value="isi" className={tabContentClass}>
          <ReportSectionList sections={data.sections} />
        </TabsContent>
      </Tabs>
    </ResearchHubDetailPage>
  );
}
