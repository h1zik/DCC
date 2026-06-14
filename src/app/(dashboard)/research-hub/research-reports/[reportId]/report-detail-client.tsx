"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { ResearchReportStatus } from "@prisma/client";
import { toast } from "sonner";
import { refreshResearchReport } from "@/actions/research-reports";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  ReportFeedbackSankey,
  type FeedbackLoopData,
} from "@/components/research-hub/report-feedback-sankey";
import { ReportPdfDownloadButton } from "@/components/research-hub/report-pdf-download-button";
import {
  ReportSectionList,
  REPORT_BODY_HTML_CLASS,
  type ReportSectionRow,
} from "@/components/research-hub/report-section-list";
import { ReportShareLinkButton } from "@/components/research-hub/report-share-link-button";
import { reportBodyToHtml } from "@/lib/research/reports/report-body-html";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RESEARCH_REPORT_STATUS_LABELS,
  RESEARCH_REPORT_TYPE_LABELS,
} from "@/lib/research/labels";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";

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

function statusTone(status: ResearchReportStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "GENERATING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

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

  return (
    <div className="space-y-6">
      <ResearchModelBadgeGroup meta={data.aiMeta} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/research-hub/research-reports"
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3" /> Kembali
          </Link>
          <h1 className="text-xl font-semibold">{data.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {RESEARCH_REPORT_TYPE_LABELS[data.type as keyof typeof RESEARCH_REPORT_TYPE_LABELS] ?? data.type}
            {data.periodStart && data.periodEnd
              ? ` · ${data.periodStart.slice(0, 10)} – ${data.periodEnd.slice(0, 10)}`
              : ""}
          </p>
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
              statusTone(data.status),
            )}
          >
            {RESEARCH_REPORT_STATUS_LABELS[data.status]}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <ReportShareLinkButton path={data.sharePath} />
          {data.status === "READY" ? (
            <ReportPdfDownloadButton reportId={data.id} title={data.title} />
          ) : null}
          <Button size="sm" onClick={handleRefresh} disabled={pending}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {data.errorMessage ? (
        <p className="text-rose-700 dark:text-rose-300 text-sm">{data.errorMessage}</p>
      ) : null}

      {data.aiSummary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Executive Summary</CardTitle>
          </CardHeader>
          <CardContent
            className={REPORT_BODY_HTML_CLASS}
            dangerouslySetInnerHTML={{ __html: reportBodyToHtml(data.aiSummary) }}
          />
        </Card>
      ) : null}

      {data.actionItems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rekomendasi Aksi Lintas-Modul
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.actionItems.map((item, i) => {
              const body = (
                <div className="border-border flex items-start gap-3 rounded-lg border p-3">
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
                <Link key={i} href={item.href} className="block hover:opacity-90">
                  {body}
                </Link>
              ) : (
                <div key={i}>{body}</div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {data.feedbackLoop ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feedback Loop Riset</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportFeedbackSankey data={data.feedbackLoop} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Isi Laporan</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportSectionList sections={data.sections} />
        </CardContent>
      </Card>
    </div>
  );
}
