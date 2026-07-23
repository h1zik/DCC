"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus, SeoReportType } from "@prisma/client";
import {
  Download,
  FileDown,
  FileText,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { SEO_STATUS_LABELS, isSeoStatusBusy } from "@/lib/seo/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { actionErrorMessage } from "@/lib/action-error-message";
import { downloadHtmlAsPdf } from "@/lib/research/research-pdf-client";
import {
  createSeoReport,
  deleteSeoReport,
  getSeoReportPdfHtml,
} from "@/actions/seo-reports";
import { cn } from "@/lib/utils";

const REPORT_TYPE_LABELS: Record<SeoReportType, string> = {
  OVERVIEW: "Ringkasan",
  RANK_TRACKING: "Ranking",
  TECHNICAL: "Teknis",
  FULL: "Lengkap",
};

/** Badge tinta per tipe laporan. */
const REPORT_TYPE_TONES: Record<SeoReportType, string> = {
  OVERVIEW: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  RANK_TRACKING: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  TECHNICAL: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  FULL: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

const REPORT_TYPE_ITEMS: SelectItemDef[] = Object.values(SeoReportType).map(
  (t) => ({ value: t, label: REPORT_TYPE_LABELS[t] }),
);

export type ReportRow = {
  id: string;
  title: string;
  type: SeoReportType;
  status: SeoAnalysisStatus;
  errorMessage: string | null;
  createdAt: string;
};

export type ReportsSummary = {
  total: number;
  ready: number;
  busy: number;
  failed: number;
  lastCreatedAt: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Pill status dengan dot berwarna (amber berdenyut saat proses berjalan). */
function StatusPill({ status }: { status: SeoAnalysisStatus }) {
  const busy = isSeoStatusBusy(status);
  const tone =
    status === SeoAnalysisStatus.READY
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : status === SeoAnalysisStatus.FAILED
        ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
        : busy
          ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
          : "bg-muted text-muted-foreground";
  const dot =
    status === SeoAnalysisStatus.READY
      ? "bg-emerald-500"
      : status === SeoAnalysisStatus.FAILED
        ? "bg-rose-500"
        : busy
          ? "animate-pulse bg-amber-500"
          : "bg-muted-foreground/50";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {SEO_STATUS_LABELS[status]}
    </span>
  );
}

function CardStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

export function ReportsClient({
  reports,
  summary,
}: {
  reports: ReportRow[];
  summary: ReportsSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(reports.length === 0);
  const [type, setType] = useState<SeoReportType>(SeoReportType.OVERVIEW);
  const [title, setTitle] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const hasBusy = reports.some((r) => isSeoStatusBusy(r.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    startTransition(async () => {
      try {
        await createSeoReport({ type, title: title.trim() || undefined });
        setTitle("");
        setFormOpen(false);
        toast.success("Laporan dibuat — agregasi berjalan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat laporan."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoReport(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  async function handleExportPdf(report: ReportRow) {
    setDownloadingId(report.id);
    try {
      const html = await getSeoReportPdfHtml(report.id);
      await downloadHtmlAsPdf(report.title, html);
      toast.success("PDF diunduh.");
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal ekspor PDF."));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan laporan */}
      {reports.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Total laporan
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.total}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              agregasi dari modul SEO
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Siap diunduh</span>
            <span className="bento-value">{summary.ready}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              ekspor PDF / DOCX
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Berjalan · Gagal</span>
            <span className="flex items-baseline gap-3">
              <span className="bento-value text-amber-600 dark:text-amber-400">
                {summary.busy}
              </span>
              <span className="bento-value text-rose-600 dark:text-rose-400">
                {summary.failed}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              status proses saat ini
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Terakhir dibuat</span>
            <span className="bento-value text-2xl">
              {summary.lastCreatedAt ? formatDate(summary.lastCreatedAt) : "—"}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              laporan terbaru
            </span>
          </div>
        </div>
      ) : null}

      {/* Header daftar laporan + toggle form */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Laporan</h2>
            <p className={lab.sectionDesc}>
              {reports.length === 0
                ? "Buat laporan SEO pertama Anda di bawah, lalu ekspor PDF/DOCX."
                : `${reports.length} laporan terdokumentasi.`}
            </p>
          </div>
          {reports.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Laporan baru"}
            </Button>
          ) : null}
        </div>

        {/* Form laporan baru (collapsible) */}
        {formOpen ? (
          <div
            className={cn(
              lab.panel,
              "grid gap-4",
              "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
            )}
          >
            <div>
              <p className="text-foreground font-bold tracking-tight">
                Laporan baru
              </p>
              <p className="text-muted-foreground text-sm">
                Pilih cakupan laporan. Data diagregasi dari modul SEO yang ada.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label>Tipe</Label>
                <Select
                  value={type}
                  items={REPORT_TYPE_ITEMS}
                  onValueChange={(v) => {
                    if (v) setType(v as SeoReportType);
                  }}
                >
                  <SelectTrigger>{REPORT_TYPE_LABELS[type]}</SelectTrigger>
                  <SelectContent>
                    {Object.values(SeoReportType).map((t) => (
                      <SelectItem key={t} value={t}>
                        {REPORT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Judul (opsional)</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Laporan SEO Mingguan"
                  disabled={pending}
                />
              </div>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                Buat laporan
              </Button>
            </div>
          </div>
        ) : null}

        {/* Kartu laporan */}
        {reports.length === 0 ? (
          <LabEmptyState
            icon={FileText}
            title="Belum ada laporan"
            description="Buat laporan SEO pertama lewat form di atas, lalu ekspor PDF/DOCX."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {reports.map((r) => {
              const ready = r.status === SeoAnalysisStatus.READY;
              return (
                <div key={r.id} className={cn(lab.card, "flex flex-col p-0")}>
                  <div className="flex flex-1 flex-col gap-4 p-5 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
                          aria-hidden
                        >
                          <FileText className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-foreground truncate font-bold tracking-tight">
                            {r.title}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {formatDateTime(r.createdAt)}
                          </p>
                        </div>
                      </div>
                      <StatusPill status={r.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <CardStat
                        label="Tipe"
                        value={
                          <span
                            className={cn(
                              "rounded-lg px-2 py-0.5 text-xs font-bold",
                              REPORT_TYPE_TONES[r.type],
                            )}
                          >
                            {REPORT_TYPE_LABELS[r.type]}
                          </span>
                        }
                      />
                      <CardStat label="Dibuat" value={formatDate(r.createdAt)} />
                    </div>

                    {r.status === SeoAnalysisStatus.FAILED && r.errorMessage ? (
                      <p className="text-destructive line-clamp-2 text-xs">
                        {r.errorMessage}
                      </p>
                    ) : null}
                  </div>

                  <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      {ready ? "Siap diunduh" : SEO_STATUS_LABELS[r.status]}
                    </span>
                    <div className="flex items-center gap-1">
                      {ready ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportPdf(r)}
                            disabled={downloadingId === r.id}
                          >
                            {downloadingId === r.id ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <FileDown />
                            )}
                            PDF
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            render={
                              <a
                                href={`/api/seo/reports/${r.id}/docx`}
                                target="_blank"
                                rel="noreferrer"
                              />
                            }
                          >
                            <Download />
                            DOCX
                          </Button>
                        </>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(r.id)}
                        disabled={pending}
                        aria-label="Hapus laporan"
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
