"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus, SeoReportType } from "@prisma/client";
import { Download, FileDown, FileText, Loader2, Plus, Trash2 } from "lucide-react";
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
import {
  ResearchHubEmptyState,
  ResearchHubSection,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { isSeoStatusBusy } from "@/lib/seo/labels";
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

export type ReportRow = {
  id: string;
  title: string;
  type: SeoReportType;
  status: SeoAnalysisStatus;
  errorMessage: string | null;
  createdAt: string;
};

export function ReportsClient({ reports }: { reports: ReportRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<SeoReportType>(SeoReportType.OVERVIEW);
  const [title, setTitle] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const hasBusy = reports.some((r) => isSeoStatusBusy(r.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    startTransition(async () => {
      try {
        await createSeoReport({ type, title: title.trim() || undefined });
        setTitle("");
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
      <ResearchHubSection
        title="Laporan baru"
        description="Pilih cakupan laporan. Data diagregasi dari modul SEO yang ada."
      >
        <div className={cn(hub.panel, "grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end")}>
          <div className="grid gap-1.5">
            <Label>Tipe</Label>
            <Select
              value={type}
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
      </ResearchHubSection>

      <ResearchHubSection title="Laporan" description={`${reports.length} laporan.`}>
        {reports.length === 0 ? (
          <ResearchHubEmptyState
            icon={FileText}
            title="Belum ada laporan"
            description="Buat laporan SEO pertama di atas, lalu ekspor PDF/DOCX."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map((r) => {
              const ready = r.status === SeoAnalysisStatus.READY;
              return (
                <div key={r.id} className={cn(hub.card, "flex items-center gap-3 p-3")}>
                  <FileText className="text-muted-foreground size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate font-medium">{r.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {REPORT_TYPE_LABELS[r.type]} ·{" "}
                      {new Date(r.createdAt).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {r.status === SeoAnalysisStatus.FAILED && r.errorMessage ? (
                      <p className="text-destructive truncate text-xs">
                        {r.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  {ready ? (
                    <>
                      <Button
                        variant="outline"
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
                        variant="outline"
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
                  ) : (
                    <SeoStatusBadge status={r.status} />
                  )}
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
              );
            })}
          </div>
        )}
      </ResearchHubSection>
    </div>
  );
}
