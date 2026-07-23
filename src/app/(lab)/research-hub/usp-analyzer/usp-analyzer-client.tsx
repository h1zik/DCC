"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { UspGapStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  createUspGapAnalysis,
  deleteUspGapAnalysis,
  refreshUspGapAnalysis,
  suggestUspContextSources,
} from "@/actions/research-usp-gap";
import {
  UspContextSourcePicker,
  UspModuleSummaryChips,
} from "@/components/research-hub/usp-context-source-picker";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USP_GAP_STATUS_LABELS, formatRelativeTime } from "@/lib/research/labels";
import type {
  ContextModuleToggles,
  ContextSourceIds,
  StoredContextModules,
  UspContextSourceOptions,
} from "@/lib/research/usp-gap/context-types";
import type { AvailableContextModules } from "@/lib/research/usp-gap/gather-context";
import { lab, LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

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
  return (
    status === "GATHERING" ||
    status === "ANALYZING" ||
    status === "PENDING"
  );
}

/** Pill status analisis gaya bento (emerald siap / amber berjalan / rose gagal). */
function AnalysisStatusPill({ status }: { status: UspGapStatus }) {
  const tone =
    status === "READY"
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : status === "FAILED"
        ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
        : isInProgress(status)
          ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
          : "bg-muted text-muted-foreground";
  const dot =
    status === "READY"
      ? "bg-emerald-500"
      : status === "FAILED"
        ? "bg-rose-500"
        : isInProgress(status)
          ? "bg-amber-500"
          : "bg-muted-foreground/50";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {USP_GAP_STATUS_LABELS[status]}
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

function defaultModules(available: AvailableModules): ContextModuleToggles {
  return {
    reviewIntel: available.reviewIntel,
    competitor: available.competitor,
    trendRadar: available.trendRadar,
    keywordIntel: available.keywordIntel,
    socialListening: available.socialListening,
    productDiscovery: available.productDiscovery,
    competitorProducts: available.competitorProducts,
  };
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
  const [suggestPending, setSuggestPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [modules, setModules] = useState<ContextModuleToggles>(() =>
    defaultModules(availableModules),
  );
  const [selections, setSelections] = useState<ContextSourceIds>({});

  const hasInProgress = analyses.some((a) => isInProgress(a.status));
  const readyCount = analyses.filter((a) => a.status === "READY").length;
  const runningCount = analyses.filter((a) => isInProgress(a.status)).length;
  const failedCount = analyses.filter((a) => a.status === "FAILED").length;
  const totalUsps = analyses.reduce((sum, a) => sum + a.uspCount, 0);
  const avgScore =
    analyses.filter((a) => a.differentiationScore != null).length > 0
      ? Math.round(
          analyses
            .filter((a) => a.differentiationScore != null)
            .reduce((sum, a) => sum + (a.differentiationScore ?? 0), 0) /
            analyses.filter((a) => a.differentiationScore != null).length,
        )
      : null;

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  function resetDialog() {
    setCategory("");
    setModules(defaultModules(availableModules));
    setSelections({});
  }

  function toggleModule(key: keyof ContextModuleToggles) {
    if (!availableModules[key]) return;
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function applySuggestions() {
    if (!category.trim()) {
      toast.error("Masukkan kategori dulu.");
      return;
    }
    setSuggestPending(true);
    startTransition(async () => {
      try {
        const suggested = await suggestUspContextSources(category.trim());
        setSelections({
          reviewSourceIds: suggested.reviewSourceIds,
          competitorIds: suggested.competitorIds,
          trendDigestId: suggested.trendDigestId ?? undefined,
          keywordQueryId: suggested.keywordQueryId ?? undefined,
          socialMonitorId: suggested.socialMonitorId ?? undefined,
          productDiscoveryQueryIds: suggested.productDiscoveryQueryIds,
          competitorProductCategoryIds: suggested.competitorProductCategoryIds,
        });
        toast.success("Saran sumber diterapkan.");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengambil saran."));
      } finally {
        setSuggestPending(false);
      }
    });
  }

  function handleCreate() {
    if (!category.trim()) {
      toast.error("Masukkan kategori produk.");
      return;
    }

    const contextModules = { ...modules, ...selections };

    startTransition(async () => {
      try {
        const result = await createUspGapAnalysis({
          category: category.trim(),
          contextModules,
        });
        toast.success("Analisis USP dimulai.");
        setDialogOpen(false);
        resetDialog();
        router.push(`/research-hub/usp-analyzer/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menjalankan analisis."));
      }
    });
  }

  function handleRefresh(id: string) {
    startTransition(async () => {
      try {
        await refreshUspGapAnalysis(id);
        toast.success("Refresh analisis dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus analisis ini?")) return;
    startTransition(async () => {
      try {
        await deleteUspGapAnalysis(id);
        toast.success("Analisis dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Strip ringkasan bento */}
      {analyses.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          {/* Hero violet */}
          <div className="bento-tile border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Analisis
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {analyses.length}
            </span>
            <span className="text-[11px] font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
              {readyCount} siap
              {runningCount > 0 ? ` · ${runningCount} berjalan` : ""}
              {failedCount > 0 ? ` · ${failedCount} gagal` : ""}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Total kandidat USP</span>
            <span className="bento-value">
              {totalUsps.toLocaleString("id-ID")}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              dari semua kategori
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Rata-rata skor
            </span>
            <span className="bento-value text-violet-900 dark:text-violet-300">
              {avgScore != null ? avgScore : "—"}
              {avgScore != null ? (
                <span className="text-lg font-bold text-violet-700/50 dark:text-violet-300/50">
                  /100
                </span>
              ) : null}
            </span>
            <span className="text-[11px] font-medium text-violet-700/60 dark:text-violet-300/50">
              skor diferensiasi
            </span>
          </div>

          {failedCount > 0 ? (
            <div className="bento-tile border-transparent bg-[#fbdcd7] dark:bg-rose-400/10">
              <span className="text-[11.5px] font-semibold text-rose-800/70 dark:text-rose-200/60">
                Gagal
              </span>
              <span className="bento-value text-rose-900 dark:text-rose-300">
                {failedCount}
              </span>
              <span className="text-[11px] font-medium text-rose-800/60 dark:text-rose-200/50">
                refresh untuk mengulang
              </span>
            </div>
          ) : (
            <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
              <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
                Sedang berjalan
              </span>
              <span className="bento-value text-amber-900 dark:text-amber-300">
                {runningCount}
              </span>
              <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-200/50">
                pipeline modul + AI
              </span>
            </div>
          )}
        </div>
      ) : null}

      {hasInProgress ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="Analisis USP & gap berjalan"
            percent={45}
            stepLabel="Mengumpulkan konteks modul 1–5 lalu menjalankan AI gap matrix & positioning."
          />
          <p className="text-muted-foreground mt-1.5 px-1 text-xs">
            Halaman diperbarui otomatis setiap beberapa detik.
          </p>
        </div>
      ) : null}

      <LabSection
        title="Analisis USP & Gap"
        description="Agregasi data modul riset untuk gap matrix, positioning, dan kandidat USP."
        action={
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetDialog();
            }}
          >
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" aria-hidden />
                  Analisis Baru
                </Button>
              }
            />
            <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
              <DialogHeader className="border-border/60 space-y-1 border-b px-6 py-5">
                <DialogTitle className="text-lg">
                  Analisis USP & Gap Baru
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Gabungkan insight dari modul riset, lalu generate gap matrix,
                  positioning map, dan kandidat USP.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <section className={cn(lab.nestedPanel, "space-y-3")}>
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_15%,transparent)] text-xs font-bold text-[var(--lab-accent,var(--primary))]">
                      1
                    </span>
                    <Label htmlFor="usp-category" className="text-sm font-medium">
                      Kategori produk
                    </Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="usp-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Contoh: helm cleaner, body serum brightening"
                      className="h-10"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 shrink-0 gap-1.5"
                      disabled={suggestPending || pending || !category.trim()}
                      onClick={applySuggestions}
                    >
                      <Sparkles className="size-3.5" aria-hidden />
                      Saran
                    </Button>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_15%,transparent)] text-xs font-bold text-[var(--lab-accent,var(--primary))]">
                      2
                    </span>
                    <span className="text-sm font-medium">Pilih sumber data</span>
                  </div>
                  <UspContextSourcePicker
                    options={sourceOptions}
                    available={availableModules}
                    modules={modules}
                    selections={selections}
                    onToggleModule={toggleModule}
                    onSelectionsChange={setSelections}
                  />
                </section>
              </div>

              <DialogFooter className="border-border/60 bg-muted/15 flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full min-w-0 sm:flex-1">
                  <p className="text-muted-foreground mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide">
                    <Layers className="size-3" aria-hidden />
                    Modul aktif
                  </p>
                  <UspModuleSummaryChips
                    modules={modules}
                    available={availableModules}
                  />
                </div>
                <Button
                  className="w-full shrink-0 sm:w-auto"
                  onClick={handleCreate}
                  disabled={pending || !category.trim()}
                >
                  {pending ? "Menganalisis…" : "Jalankan Analisis"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {analyses.length === 0 ? (
          <LabEmptyState
            icon={BarChart3}
            title="Belum ada analisis USP"
            description="Buat analisis untuk kategori produk — pilih modul riset dan sumber spesifik agar hasil lebih terbukti."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Analisis Baru
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {analyses.map((a, index) => (
              <div
                key={a.id}
                className={cn(lab.card, lab.entrance, "group flex flex-col p-0")}
                style={
                  index > 0 && index < 8
                    ? { animationDelay: `${index * 40}ms` }
                    : undefined
                }
              >
                <Link
                  href={`/research-hub/usp-analyzer/${a.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold uppercase"
                        aria-hidden
                      >
                        {a.category.trim().charAt(0) || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{a.category}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {countActiveModules(a.contextModules)} modul riset ·{" "}
                          {formatRelativeTime(new Date(a.createdAt))}
                        </p>
                      </div>
                    </div>
                    <AnalysisStatusPill status={a.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <CardStat
                      label="USP"
                      value={a.uspCount.toLocaleString("id-ID")}
                    />
                    <CardStat
                      label="Skor"
                      value={
                        a.differentiationScore != null ? (
                          <>
                            {Math.round(a.differentiationScore).toLocaleString(
                              "id-ID",
                            )}
                            <span className="text-muted-foreground/60 text-xs font-bold">
                              /100
                            </span>
                          </>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <CardStat
                      label="Modul"
                      value={countActiveModules(a.contextModules)}
                    />
                  </div>

                  {a.status === "FAILED" && a.errorMessage ? (
                    <p className="line-clamp-2 text-xs leading-snug text-rose-600 dark:text-rose-400">
                      {a.errorMessage}
                    </p>
                  ) : null}
                </Link>

                <div className="border-border/60 flex items-center justify-end gap-1 border-t px-3 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending || isInProgress(a.status)}
                    onClick={() => handleRefresh(a.id)}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Refresh
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => handleDelete(a.id)}
                    aria-label="Hapus analisis"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </LabSection>
    </div>
  );
}
