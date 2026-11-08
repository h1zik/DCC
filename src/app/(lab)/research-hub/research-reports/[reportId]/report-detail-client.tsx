"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import {
  FileText,
  GitBranch,
  ListChecks,
  Loader2,
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
import { ReportPdfDownloadButton } from "@/components/research-hub/report-pdf-download-button";
import type { ReportSectionRow } from "@/components/research-hub/report-section-list";
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
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import {
  REPORT_PROSE_CLASS,
  ReportActionList,
  ReportDocument,
  type ReportActionItem,
} from "./report-reading";

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
  actionItems: ReportActionItem[];
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

const METRIC_ROWS: { key: keyof ReportActivityMetrics; label: string }[] = [
  { key: "reviewSourcesReady", label: "Sumber review siap" },
  { key: "competitorsTracked", label: "Kompetitor dipantau" },
  { key: "trendDigests", label: "Trend digest" },
  { key: "keywordQueries", label: "Query keyword" },
  { key: "socialBatches", label: "Batch social" },
  { key: "uspAnalyses", label: "Analisis USP" },
  { key: "productConcepts", label: "Konsep produk" },
];

function toneOf(status: ResearchReportStatus): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (status === "GENERATING" || status === "PENDING") return "running";
  return "idle";
}

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });

const tabContentClass =
  "animate-in fade-in duration-200 motion-reduce:animate-none flex flex-col gap-8 pt-6";

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="max-w-[72ch] space-y-0.5">
        <h2 className="rh-section-title">{title}</h2>
        {meta ? <p className="rh-meta">{meta}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ReportDetailClient({ data }: { data: ReportDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const tone = toneOf(data.status);
  const inProgress = tone === "running";

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [inProgress, router]);

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshResearchReport(data.id);
        toast.success("Laporan sedang ditulis ulang. Versi sekarang diarsipkan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Penulisan ulang gagal dimulai."));
      }
    });
  }

  const typeLabel =
    RESEARCH_REPORT_TYPE_LABELS[data.type as keyof typeof RESEARCH_REPORT_TYPE_LABELS] ?? data.type;
  const periodLabel =
    data.periodStart && data.periodEnd
      ? `${dateFmt.format(new Date(data.periodStart))} sampai ${dateFmt.format(new Date(data.periodEnd))}`
      : null;

  const hasContent =
    data.sections.length > 0 || data.actionItems.length > 0 || data.metrics != null;

  return (
    <ResearchHubDetailPage
      icon={FileText}
      backHref="/research-hub/research-reports"
      title={data.title}
      meta={
        <>
          <RunStatusBadge tone={tone} label={RESEARCH_REPORT_STATUS_LABELS[data.status]} />
          <span>{typeLabel}</span>
          {periodLabel ? <span>Periode {periodLabel}</span> : null}
          <span>
            Versi {data.version}
            {data.revisionCount > 0 ? `, ${data.revisionCount} versi lama diarsip` : ""}
          </span>
          <ResearchModelBadgeGroup meta={data.aiMeta} />
        </>
      }
      right={
        <>
          <ReportShareLinkButton path={data.sharePath} />
          {data.status === "READY" ? (
            <ReportPdfDownloadButton reportId={data.id} title={data.title} />
          ) : null}
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={pending || inProgress}>
            <RefreshCw className={cn(pending && "motion-safe:animate-spin")} aria-hidden />
            Tulis ulang
          </Button>
        </>
      }
    >
      {inProgress ? (
        <div
          className="border-border bg-muted/30 flex items-start gap-3 rounded-xl border px-4 py-3"
          aria-live="polite"
        >
          <Loader2 className="text-muted-foreground mt-0.5 size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">AI sedang menulis laporan</p>
            <p className="rh-meta">
              Data modul riset dikumpulkan lalu tiap bagian ditulis. Halaman ini diperbarui otomatis.
            </p>
          </div>
        </div>
      ) : null}

      {data.status === "FAILED" ? (
        <div
          className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Laporan gagal ditulis</p>
            {data.errorMessage ? <p className="mt-0.5">{data.errorMessage}</p> : null}
            <p className="mt-1 text-xs">Periksa sumber data, lalu klik Tulis ulang.</p>
          </div>
        </div>
      ) : null}

      {!inProgress && hasContent ? (
        <section aria-labelledby="report-glance-title" className="flex flex-col gap-4">
          <h2 id="report-glance-title" className="sr-only">Sekilas laporan</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <dt className="rh-meta">Rekomendasi aksi</dt>
              <dd className="rh-num text-foreground mt-0.5 text-lg font-semibold">{data.actionItems.length}</dd>
            </div>
            <div>
              <dt className="rh-meta">Bagian laporan</dt>
              <dd className="rh-num text-foreground mt-0.5 text-lg font-semibold">{data.sections.length}</dd>
            </div>
          </dl>
          {data.metrics ? (
            <div>
              <p className="rh-meta mb-1.5">Aktivitas modul dalam periode laporan</p>
              <dl className="flex flex-wrap gap-x-6 gap-y-1.5">
                {METRIC_ROWS.map((row) => (
                  <div key={row.key} className="flex items-baseline gap-1.5 text-sm">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="rh-num text-foreground font-medium">
                      {data.metrics![row.key].toLocaleString("id-ID")}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </section>
      ) : null}

      <Tabs defaultValue="ringkasan" className="gap-0">
        <div className={cn(lab.stickyToolbar, "pb-0")}>
          <TabsList variant="line" className="h-9 w-full justify-start gap-4">
            <TabsTrigger value="ringkasan" className="px-1">
              <Sparkles className="size-3.5" aria-hidden />
              Ringkasan
            </TabsTrigger>
            <TabsTrigger value="isi" className="px-1">
              <FileText className="size-3.5" aria-hidden />
              Isi laporan
              {data.sections.length > 0 ? (
                <span className="text-muted-foreground rh-num ml-1 text-xs">{data.sections.length}</span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="aksi" className="px-1">
              <ListChecks className="size-3.5" aria-hidden />
              Aksi
              {data.actionItems.length > 0 ? (
                <span className="text-muted-foreground rh-num ml-1 text-xs">{data.actionItems.length}</span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="alur" className="px-1">
              <GitBranch className="size-3.5" aria-hidden />
              Alur riset
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          <Section title="Ringkasan eksekutif">
            {data.aiSummary ? (
              <div
                className={REPORT_PROSE_CLASS}
                dangerouslySetInnerHTML={{ __html: reportBodyToHtml(data.aiSummary) }}
              />
            ) : (
              <ResearchPanelEmpty
                icon={Sparkles}
                title="Ringkasan belum tersedia"
                description={
                  inProgress
                    ? "Ringkasan ditulis setelah semua bagian laporan selesai."
                    : "Laporan ini tidak punya ringkasan eksekutif. Klik Tulis ulang untuk membuatnya."
                }
              />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="isi" className={tabContentClass}>
          {data.sections.length > 0 ? (
            <ReportDocument sections={data.sections} />
          ) : (
            <ResearchPanelEmpty
              icon={FileText}
              title="Belum ada isi laporan"
              description={
                inProgress
                  ? "Bagian laporan muncul di sini begitu AI selesai menulis."
                  : "Sumber riset belum cukup untuk menulis bagian laporan. Tambah sumber data lalu tulis ulang."
              }
            />
          )}
        </TabsContent>

        <TabsContent value="aksi" className={tabContentClass}>
          <Section
            title="Rekomendasi aksi"
            meta="Diurutkan per prioritas, lintas modul riset. P0 paling mendesak."
          >
            {data.actionItems.length > 0 ? (
              <ReportActionList items={data.actionItems} />
            ) : (
              <ResearchPanelEmpty
                icon={ListChecks}
                title="Belum ada rekomendasi aksi"
                description="Rekomendasi muncul bila modul riset punya temuan yang bisa ditindaklanjuti dalam periode laporan."
              />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="alur" className={tabContentClass}>
          <Section
            title="Volume aktivitas riset"
            meta="Jumlah record nyata per modul dalam periode laporan."
          >
            {data.feedbackLoop ? (
              <>
                <div className="border-border bg-card rounded-xl border p-4">
                  <ReportFeedbackSankey data={data.feedbackLoop} />
                </div>
                <p className="rh-meta max-w-[72ch]">
                  Diagram ini menunjukkan volume, bukan jejak per item. Hanya hubungan
                  analisis USP ke konsep produk yang merupakan relasi langsung.
                </p>
              </>
            ) : (
              <ResearchPanelEmpty
                icon={GitBranch}
                title="Alur riset belum tersedia"
                description="Diagram alur dibuat pada laporan generasi baru. Tulis ulang laporan ini untuk melihatnya."
              />
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </ResearchHubDetailPage>
  );
}
