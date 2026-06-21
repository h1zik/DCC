"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BarChart3, Layers, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
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
import {
  hub,
  ResearchHubEmptyState,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
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

function statusChipTone(
  status: UspGapStatus,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "GATHERING":
    case "ANALYZING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

function isInProgress(status: UspGapStatus) {
  return (
    status === "GATHERING" ||
    status === "ANALYZING" ||
    status === "PENDING"
  );
}

function countActiveModules(modules: StoredContextModules): number {
  return [
    modules.reviewIntel,
    modules.competitor,
    modules.trendRadar,
    modules.keywordIntel,
    modules.socialListening,
  ].filter(Boolean).length;
}

function defaultModules(available: AvailableModules): ContextModuleToggles {
  return {
    reviewIntel: available.reviewIntel,
    competitor: available.competitor,
    trendRadar: available.trendRadar,
    keywordIntel: available.keywordIntel,
    socialListening: available.socialListening,
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
    const id = window.setInterval(() => router.refresh(), 12_000);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <ResearchHubStatChip
            label="Analisis"
            value={analyses.length.toLocaleString("id-ID")}
            tone="primary"
          />
          <ResearchHubStatChip
            label="Siap"
            value={readyCount.toLocaleString("id-ID")}
            tone="success"
          />
          <ResearchHubStatChip
            label="Total USP"
            value={totalUsps.toLocaleString("id-ID")}
          />
          {avgScore != null ? (
            <ResearchHubStatChip
              label="Avg score"
              value={avgScore.toLocaleString("id-ID")}
            />
          ) : null}
        </div>

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
              <DialogTitle className="text-lg">Analisis USP & Gap Baru</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Gabungkan insight dari modul riset, lalu generate gap matrix,
                positioning map, dan kandidat USP.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <section className={cn(hub.nestedPanel, "space-y-3")}>
                <div className="flex items-center gap-2">
                  <span className="bg-primary/15 text-primary flex size-7 items-center justify-center rounded-lg text-xs font-bold">
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
                  <span className="bg-primary/15 text-primary flex size-7 items-center justify-center rounded-lg text-xs font-bold">
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
      </div>

      {hasInProgress ? (
        <div className={hub.entrance}>
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

      <ResearchHubSection
        title="Analisis USP & Gap"
        description="Agregasi data modul riset untuk gap matrix, positioning, dan kandidat USP."
      >
        {analyses.length === 0 ? (
          <ResearchHubEmptyState
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
          <div className="grid gap-3 sm:grid-cols-2">
            {analyses.map((a, index) => (
              <div
                key={a.id}
                className={cn(hub.panel, hub.cardHover, hub.entrance)}
                style={
                  index > 0 && index < 8
                    ? { animationDelay: `${index * 40}ms` }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/research-hub/usp-analyzer/${a.id}`}
                      className="hover:text-primary text-base font-semibold transition-colors duration-150 motion-reduce:transition-none"
                    >
                      {a.category}
                    </Link>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {countActiveModules(a.contextModules)} modul aktif
                    </p>
                  </div>
                  <ResearchHubStatChip
                    label="Status"
                    value={USP_GAP_STATUS_LABELS[a.status]}
                    tone={statusChipTone(a.status)}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ResearchHubStatChip
                    label="USP"
                    value={a.uspCount.toLocaleString("id-ID")}
                    tone="primary"
                  />
                  <ResearchHubStatChip
                    label="Score"
                    value={
                      a.differentiationScore != null
                        ? Math.round(a.differentiationScore).toLocaleString("id-ID")
                        : "—"
                    }
                  />
                  <ResearchHubStatChip
                    label="Dibuat"
                    value={formatRelativeTime(new Date(a.createdAt))}
                  />
                </div>

                <div className="mt-3 flex gap-1 border-t border-border/40 pt-3">
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
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => handleDelete(a.id)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ResearchHubSection>
    </div>
  );
}
