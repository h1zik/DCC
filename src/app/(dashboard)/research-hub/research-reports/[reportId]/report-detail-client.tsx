"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import {
  FileText,
  GitBranch,
  ListChecks,
  RefreshCw,
  Sparkles,
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
import { reportBodyToHtml } from "@/lib/research/reports/report-body-html";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RESEARCH_REPORT_STATUS_LABELS,
  RESEARCH_REPORT_TYPE_LABELS,
} from "@/lib/research/labels";
import {
  hub,
  ResearchHubPageHeader,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
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
  }[];
  feedbackLoop: FeedbackLoopData | null;
  metrics: ReportActivityMetrics | null;
  periodStart: string | null;
  periodEnd: string | null;
  errorMessage: string | null;
  aiMeta: ResearchAiMetaView | null;
  sharePath: string;
};

const PRIORITY_TONE: Record<string, string> = {
  P0: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  P1: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  P2: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

function statusChipTone(
  status: ResearchReportStatus,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "GENERATING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
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

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Link
        href="/research-hub/research-reports"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
      >
        <FileText className="size-3" aria-hidden />
        Kembali ke Research Reports
      </Link>

      <ResearchHubPageHeader
        variant="detail"
        icon={FileText}
        eyebrow="Research Reports"
        title={data.title}
        description={`${RESEARCH_REPORT_TYPE_LABELS[data.type as keyof typeof RESEARCH_REPORT_TYPE_LABELS] ?? data.type}${periodLabel ? ` · ${periodLabel}` : ""}`}
        right={
          <>
            <ResearchModelBadgeGroup meta={data.aiMeta} />
            <ReportShareLinkButton path={data.sharePath} />
            {data.status === "READY" ? (
              <ReportPdfDownloadButton reportId={data.id} title={data.title} />
            ) : null}
            <Button size="sm" onClick={handleRefresh} disabled={pending || inProgress}>
              <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
              Refresh
            </Button>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <ResearchHubStatChip
              label="Status"
              value={RESEARCH_REPORT_STATUS_LABELS[data.status]}
              tone={statusChipTone(data.status)}
            />
            <ResearchHubStatChip
              label="Section"
              value={data.sections.length.toLocaleString("id-ID")}
              tone="primary"
            />
            <ResearchHubStatChip
              label="Aksi"
              value={data.actionItems.length.toLocaleString("id-ID")}
            />
            {data.metrics ? (
              <ResearchHubStatChip
                label="Sinyal review"
                value={data.metrics.reviewSourcesReady.toLocaleString("id-ID")}
              />
            ) : null}
          </div>
        }
      />

      {inProgress ? (
        <div className={hub.entrance}>
          <JobProgressBar
            title="Generate laporan berjalan"
            percent={50}
            stepLabel="Mengagregasi modul riset & menulis section — halaman refresh otomatis."
          />
        </div>
      ) : null}

      <Tabs defaultValue="ringkasan" className="gap-0">
        <div className={cn(hub.stickyToolbar, "pb-0")}>
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
            <ResearchHubSection title="Executive Summary" delayMs={0}>
              <div
                className={cn(hub.panel, REPORT_BODY_HTML_CLASS)}
                dangerouslySetInnerHTML={{
                  __html: reportBodyToHtml(data.aiSummary),
                }}
              />
            </ResearchHubSection>
          ) : null}

          {data.metrics ? (
            <ResearchHubSection
              title="Aktivitas Modul"
              description="Volume sinyal riset dalam periode laporan."
              delayMs={50}
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <ResearchHubStatChip
                  label="Review siap"
                  value={data.metrics.reviewSourcesReady.toLocaleString("id-ID")}
                  tone="primary"
                />
                <ResearchHubStatChip
                  label="Kompetitor"
                  value={data.metrics.competitorsTracked.toLocaleString("id-ID")}
                />
                <ResearchHubStatChip
                  label="Trend digest"
                  value={data.metrics.trendDigests.toLocaleString("id-ID")}
                />
                <ResearchHubStatChip
                  label="Keyword query"
                  value={data.metrics.keywordQueries.toLocaleString("id-ID")}
                />
                <ResearchHubStatChip
                  label="Social batch"
                  value={data.metrics.socialBatches.toLocaleString("id-ID")}
                />
                <ResearchHubStatChip
                  label="USP analisis"
                  value={data.metrics.uspAnalyses.toLocaleString("id-ID")}
                />
                <ResearchHubStatChip
                  label="Konsep"
                  value={data.metrics.productConcepts.toLocaleString("id-ID")}
                />
              </div>
            </ResearchHubSection>
          ) : null}
        </TabsContent>

        <TabsContent value="aksi" className={tabContentClass}>
          <ResearchHubSection
            title="Rekomendasi Aksi Lintas-Modul"
            description="Item deterministik dari pipeline riset — klik untuk buka sumber."
          >
            {data.actionItems.length > 0 ? (
              <div className="space-y-2">
                {data.actionItems.map((item, i) => {
                  const body = (
                    <div
                      className={cn(
                        hub.panel,
                        "flex items-start gap-3 transition-colors duration-150 motion-reduce:transition-none",
                        item.href && "hover:bg-muted/30",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                          PRIORITY_TONE[item.priority] ??
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.priority}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.action}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                          {item.rationale}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[10px] uppercase tracking-wide">
                          {item.owner}
                          {item.sourceLabel ? ` · ${item.sourceLabel}` : ""}
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
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="alur" className={tabContentClass}>
          {data.feedbackLoop ? (
            <ResearchHubSection
              title="Feedback Loop Riset"
              description="Alur sinyal → insight → konsep dalam periode laporan."
            >
              <div className={hub.panel}>
                <ReportFeedbackSankey data={data.feedbackLoop} />
              </div>
            </ResearchHubSection>
          ) : (
            <p className="text-muted-foreground text-sm">
              Data alur riset belum tersedia.
            </p>
          )}
        </TabsContent>

        <TabsContent value="isi" className={tabContentClass}>
          <ResearchHubSection
            title="Isi Laporan"
            description="Section per modul dengan referensi sumber."
          >
            <div className={hub.panel}>
              <ReportSectionList sections={data.sections} />
            </div>
          </ResearchHubSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
