"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BarChart3, Plus, RefreshCw, Trash2 } from "lucide-react";
import { UspGapStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  deleteUspGapAnalysis,
  refreshUspGapAnalysis,
} from "@/actions/research-usp-gap";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { USP_GAP_STATUS_LABELS, formatRelativeTime } from "@/lib/research/labels";
import type {
  StoredContextModules,
  UspContextSourceOptions,
} from "@/lib/research/usp-gap/context-types";
import type { AvailableContextModules } from "@/lib/research/usp-gap/gather-context";
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
import { NewUspAnalysisDialog } from "./new-analysis-dialog";

export type UspAnalysisRow = {
  id: string;
  category: string;
  status: UspGapStatus;
  differentiationScore: number | null;
  uspCount: number;
  createdAt: string;
  errorMessage: string | null;
  contextModules: StoredContextModules;
};

export type AvailableModules = AvailableContextModules;

function isInProgress(status: UspGapStatus) {
  return status === "GATHERING" || status === "ANALYZING" || status === "PENDING";
}

function toneOf(status: UspGapStatus): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (isInProgress(status)) return "running";
  return "idle";
}

const LEDGER_LABELS = { running: "Menganalisis" } as const;

function countActiveModules(modules: StoredContextModules): number {
  return [
    modules.reviewIntel,
    modules.competitor,
    modules.trendRadar,
    modules.keywordIntel,
    modules.socialListening,
    modules.productDiscovery,
    modules.competitorProducts,
  ].filter(Boolean).length;
}

export function UspAnalyzerClient({
  analyses,
  availableModules,
  sourceOptions,
}: {
  analyses: UspAnalysisRow[];
  availableModules: AvailableModules;
  sourceOptions: UspContextSourceOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<UspAnalysisRow | null>(null);

  const hasInProgress = analyses.some((a) => isInProgress(a.status));
  const counts = useMemo(() => countRunTones(analyses, (a) => toneOf(a.status)), [analyses]);
  const totalUsps = analyses.reduce((sum, a) => sum + a.uspCount, 0);
  const scored = analyses.filter((a) => a.differentiationScore != null);
  const avgScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, a) => sum + (a.differentiationScore ?? 0), 0) / scored.length,
        )
      : null;

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  const filtered = useMemo(
    () =>
      filterRuns(analyses, {
        search,
        status,
        text: (a) => a.category,
        tone: (a) => toneOf(a.status),
      }),
    [analyses, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    category: (a) => a.category,
    usp: (a) => a.uspCount,
    score: (a) => a.differentiationScore,
    modules: (a) => countActiveModules(a.contextModules),
    created: (a) => a.createdAt,
  });

  function handleRefresh(a: UspAnalysisRow) {
    startTransition(async () => {
      try {
        await refreshUspGapAnalysis(a.id);
        toast.success(`"${a.category}" dianalisis ulang.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Analisis ulang gagal dimulai."));
      }
    });
  }

  function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteUspGapAnalysis(target.id);
        toast.success(`"${target.category}" dihapus.`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Analisis gagal dihapus."));
      }
    });
  }

  const ledgerDetail = [
    `${totalUsps.toLocaleString("id-ID")} kandidat USP`,
    avgScore != null ? `rata-rata skor ${avgScore}/100` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-6">
      {analyses.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
          <RunLedger
            className="flex-1"
            counts={counts}
            noun="analisis USP"
            labels={LEDGER_LABELS}
            detail={ledgerDetail}
          />
          <Button onClick={() => setDialogOpen(true)}>
            <Plus aria-hidden />
            Analisis baru
          </Button>
        </div>
      ) : null}

      {hasInProgress ? (
        <p className="rh-meta" aria-live="polite">
          Ada analisis yang masih mengumpulkan konteks atau menjalankan AI.
          Halaman ini diperbarui otomatis setiap beberapa detik.
        </p>
      ) : null}

      {analyses.length === 0 ? (
        <LabEmptyState
          icon={BarChart3}
          title="Belum ada analisis USP"
          description="Mulai dari satu kategori produk, lalu pilih modul dan sumber riset yang mendukung agar kandidat USP punya bukti."
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Analisis baru
            </Button>
          }
        />
      ) : (
        <section aria-label="Daftar analisis" className="flex flex-col gap-3">
          <ResearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari kategori…"
            status={status}
            onStatusChange={setStatus}
            statusCounts={counts}
            statusLabels={LEDGER_LABELS}
            resultCount={filtered.length}
            totalCount={analyses.length}
            onReset={() => {
              setSearch("");
              setStatus("all");
            }}
          />

          {sorted.length === 0 ? (
            <p className="rh-meta border-border rounded-xl border border-dashed px-5 py-8 text-center text-[13px]">
              Tidak ada analisis yang cocok dengan filter ini.
            </p>
          ) : (
            <ResearchTable maxHeight="70vh">
              <TableHeader sticky>
                <TableRow>
                  <SortableHead sortKey="category" sort={sort} onSort={toggle}>
                    Kategori
                  </SortableHead>
                  <TableHead>Status</TableHead>
                  <SortableHead sortKey="usp" sort={sort} onSort={toggle} align="right">
                    Kandidat USP
                  </SortableHead>
                  <SortableHead sortKey="score" sort={sort} onSort={toggle} align="right">
                    Skor diferensiasi
                  </SortableHead>
                  <SortableHead sortKey="modules" sort={sort} onSort={toggle} align="right">
                    Modul
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
                {sorted.map((a) => {
                  const tone = toneOf(a.status);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[22rem] whitespace-normal">
                        <Link
                          href={`/research-hub/usp-analyzer/${a.id}`}
                          className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {a.category}
                        </Link>
                        {tone === "failed" && a.errorMessage ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-rose-700 dark:text-rose-300">
                            {a.errorMessage}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <RunStatusBadge tone={tone} label={USP_GAP_STATUS_LABELS[a.status]} />
                      </TableCell>
                      <TableCell className="rh-num text-right">
                        {a.uspCount > 0 ? (
                          a.uspCount.toLocaleString("id-ID")
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="rh-num text-right">
                        {a.differentiationScore != null ? (
                          <>
                            {Math.round(a.differentiationScore)}
                            <span className="text-muted-foreground"> / 100</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="rh-num text-right">
                        {countActiveModules(a.contextModules)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <time dateTime={a.createdAt} title={new Date(a.createdAt).toLocaleString("id-ID")}>
                          {formatRelativeTime(new Date(a.createdAt))}
                        </time>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={pending || isInProgress(a.status)}
                            onClick={() => handleRefresh(a)}
                            aria-label={`Analisis ulang "${a.category}"`}
                            title="Analisis ulang"
                          >
                            <RefreshCw aria-hidden />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={pending}
                            onClick={() => setDeleteTarget(a)}
                            aria-label={`Hapus "${a.category}"`}
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
      )}

      <NewUspAnalysisDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        availableModules={availableModules}
        sourceOptions={sourceOptions}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Hapus analisis "${deleteTarget?.category ?? ""}"?`}
        description="Gap matrix, positioning map, dan kandidat USP dari analisis ini ikut terhapus. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus analisis"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
