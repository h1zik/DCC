"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { FileText, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { ResearchReportStatus, ResearchReportType } from "@prisma/client";
import { toast } from "sonner";
import { deleteResearchReport, refreshResearchReport } from "@/actions/research-reports";
import { actionErrorMessage } from "@/lib/action-error-message";
import type { ReportAvailableModules } from "@/components/research-hub/research-report-source-picker";
import type { ReportSourceOptions } from "@/lib/research/reports/list-report-source-options";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  RESEARCH_REPORT_STATUS_LABELS,
  RESEARCH_REPORT_TYPE_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { LabEmptyState } from "@/components/lab/lab-primitives";
import { RunLedger, countRunTones } from "@/components/research-hub/kit/run-ledger";
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import {
  ResearchFilterBar,
  filterRuns,
  type RunToneFilter,
} from "@/components/research-hub/kit/research-filter-bar";
import {
  ResearchTable,
  SortableHead,
  useSortedRows,
} from "@/components/research-hub/kit/research-table";
import { NewReportForm } from "./new-report-form";
import { ResearchFilterEmpty } from "@/components/research-hub/kit/research-section";

export type ReportRow = {
  id: string;
  title: string;
  type: ResearchReportType;
  status: ResearchReportStatus;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  errorMessage: string | null;
};

function isInProgress(status: ResearchReportStatus) {
  return status === "GENERATING" || status === "PENDING";
}

function toneOf(status: ResearchReportStatus): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (isInProgress(status)) return "running";
  return "idle";
}

const LEDGER_LABELS = { ready: "Siap dibaca", running: "Sedang ditulis" } as const;

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  return `${dateFmt.format(new Date(start))} sampai ${dateFmt.format(new Date(end))}`;
}

export function ResearchReportsClient({
  reports,
  latestWeeklyId,
  options,
  availableModules,
}: {
  reports: ReportRow[];
  latestWeeklyId: string | null;
  options: ReportSourceOptions;
  availableModules: ReportAvailableModules;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(reports.length === 0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");
  const [typeFilter, setTypeFilter] = useState<ResearchReportType | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<ReportRow | null>(null);

  const hasInProgress = reports.some((r) => isInProgress(r.status));
  const counts = useMemo(() => countRunTones(reports, (r) => toneOf(r.status)), [reports]);
  const latestWeekly = latestWeeklyId ? reports.find((r) => r.id === latestWeeklyId) : null;

  const typeItems = useMemo((): SelectItemDef[] => {
    const present = Array.from(new Set(reports.map((r) => r.type)));
    return [
      { value: "all", label: "Semua jenis" },
      ...present.map((t) => ({ value: t, label: RESEARCH_REPORT_TYPE_LABELS[t] })),
    ];
  }, [reports]);

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  const filtered = useMemo(
    () =>
      filterRuns(
        typeFilter === "all" ? reports : reports.filter((r) => r.type === typeFilter),
        {
          search,
          status,
          text: (r) => `${r.title} ${RESEARCH_REPORT_TYPE_LABELS[r.type]}`,
          tone: (r) => toneOf(r.status),
        },
      ),
    [reports, search, status, typeFilter],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    title: (r) => r.title,
    type: (r) => RESEARCH_REPORT_TYPE_LABELS[r.type],
    period: (r) => r.periodStart,
    created: (r) => r.createdAt,
  });

  function handleRefresh(r: ReportRow) {
    startTransition(async () => {
      try {
        await refreshResearchReport(r.id);
        toast.success(`"${r.title}" ditulis ulang.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Penulisan ulang gagal dimulai."));
      }
    });
  }

  function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteResearchReport(target.id);
        toast.success(`"${target.title}" dihapus.`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Laporan gagal dihapus."));
      }
    });
  }

  const filterActive = typeFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      {reports.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
          <RunLedger
            className="flex-1"
            counts={counts}
            noun="laporan riset"
            labels={LEDGER_LABELS}
            detail={
              latestWeekly ? (
                <Link
                  href={`/research-hub/research-reports/${latestWeekly.id}`}
                  className="text-primary focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  Buka laporan mingguan terbaru
                </Link>
              ) : undefined
            }
          />
          <Button
            variant={formOpen ? "outline" : "default"}
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            aria-controls="report-form"
          >
            {formOpen ? <X aria-hidden /> : <Plus aria-hidden />}
            {formOpen ? "Tutup form" : "Laporan baru"}
          </Button>
        </div>
      ) : null}

      {hasInProgress ? (
        <p className="rh-meta" aria-live="polite">
          Ada laporan yang masih ditulis AI. Halaman ini diperbarui otomatis
          setiap beberapa detik.
        </p>
      ) : null}

      {formOpen ? (
        <NewReportForm
          id="report-form"
          options={options}
          availableModules={availableModules}
          onCancel={reports.length > 0 ? () => setFormOpen(false) : undefined}
          onCreated={() => setFormOpen(false)}
        />
      ) : null}

      {reports.length === 0 && !formOpen ? (
        <LabEmptyState
          icon={FileText}
          title="Belum ada laporan riset"
          description="Tulis laporan custom atau deep dive. Pilih sumber modul yang spesifik agar isi laporan punya bukti."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Laporan baru
            </Button>
          }
        />
      ) : null}

      {reports.length > 0 ? (
        <section aria-label="Daftar laporan" className="flex flex-col gap-3">
          <ResearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari judul laporan…"
            status={status}
            onStatusChange={setStatus}
            statusCounts={counts}
            statusLabels={LEDGER_LABELS}
            resultCount={filtered.length}
            totalCount={reports.length}
            onReset={() => {
              setSearch("");
              setStatus("all");
              setTypeFilter("all");
            }}
          >
            {typeItems.length > 2 ? (
              <Select
                value={typeFilter}
                items={typeItems}
                onValueChange={(v) => v && setTypeFilter(v as ResearchReportType | "all")}
              >
                <SelectTrigger className="h-9 w-48" aria-label="Filter jenis laporan">
                  {typeFilter === "all" ? "Semua jenis" : RESEARCH_REPORT_TYPE_LABELS[typeFilter]}
                </SelectTrigger>
                <SelectContent>
                  {typeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {filterActive && !search && status === "all" ? (
              <Button variant="ghost" size="sm" onClick={() => setTypeFilter("all")}>
                <X className="size-3.5" aria-hidden />
                Hapus filter
              </Button>
            ) : null}
          </ResearchFilterBar>

          {sorted.length === 0 ? (
            <ResearchFilterEmpty>Tidak ada laporan yang cocok dengan filter ini.</ResearchFilterEmpty>
          ) : (
            <ResearchTable maxHeight="70vh">
              <TableHeader sticky>
                <TableRow>
                  <SortableHead sortKey="title" sort={sort} onSort={toggle}>
                    Laporan
                  </SortableHead>
                  <SortableHead sortKey="type" sort={sort} onSort={toggle}>
                    Jenis
                  </SortableHead>
                  <TableHead>Status</TableHead>
                  <SortableHead sortKey="period" sort={sort} onSort={toggle}>
                    Periode
                  </SortableHead>
                  <SortableHead sortKey="created" sort={sort} onSort={toggle}>
                    Dibuat
                  </SortableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => {
                  const tone = toneOf(r.status);
                  const period = formatPeriod(r.periodStart, r.periodEnd);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-[24rem] whitespace-normal">
                        <Link
                          href={`/research-hub/research-reports/${r.id}`}
                          className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {r.title}
                        </Link>
                        {tone === "failed" && r.errorMessage ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-rose-700 dark:text-rose-300">
                            {r.errorMessage}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {RESEARCH_REPORT_TYPE_LABELS[r.type]}
                      </TableCell>
                      <TableCell>
                        <RunStatusBadge tone={tone} label={RESEARCH_REPORT_STATUS_LABELS[r.status]} />
                      </TableCell>
                      <TableCell className="text-muted-foreground rh-num">
                        {period ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <time dateTime={r.createdAt} title={new Date(r.createdAt).toLocaleString("id-ID")}>
                          {formatRelativeTime(new Date(r.createdAt))}
                        </time>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={pending || isInProgress(r.status)}
                            onClick={() => handleRefresh(r)}
                            aria-label={`Tulis ulang "${r.title}"`}
                            title="Tulis ulang"
                          >
                            <RefreshCw aria-hidden />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={pending}
                            onClick={() => setDeleteTarget(r)}
                            aria-label={`Hapus "${r.title}"`}
                            title="Hapus"
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </ResearchTable>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Hapus laporan "${deleteTarget?.title ?? ""}"?`}
        description="Isi laporan dan semua versi arsipnya ikut terhapus, dan link berbagi tidak bisa dibuka lagi. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus laporan"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
