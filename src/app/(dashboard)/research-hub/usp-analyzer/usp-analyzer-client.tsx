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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { USP_GAP_STATUS_LABELS } from "@/lib/research/labels";
import type {
  ContextModuleToggles,
  ContextSourceIds,
  StoredContextModules,
  UspContextSourceOptions,
} from "@/lib/research/usp-gap/context-types";
import type { AvailableContextModules } from "@/lib/research/usp-gap/gather-context";
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

function statusTone(status: UspGapStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "GATHERING":
    case "ANALYZING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
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

  const hasInProgress = analyses.some(
    (a) =>
      a.status === "GATHERING" ||
      a.status === "ANALYZING" ||
      a.status === "PENDING",
  );

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

    const contextModules = {
      ...modules,
      ...selections,
    };

    startTransition(async () => {
      try {
        const result = await createUspGapAnalysis({
          category: category.trim(),
          contextModules,
        });
        toast.success("Analisis USP selesai.");
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Agregasi data modul 1–5 untuk gap matrix, positioning, dan kandidat
          USP. Pilih sumber riset per modul untuk kontrol penuh.
        </p>
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
                <Plus className="mr-1.5 size-4" />
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
              <section className="border-border/60 bg-muted/20 space-y-3 rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <span className="border-primary/30 bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg border text-xs font-bold">
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
                    className="bg-background h-10"
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
                  <span className="border-primary/30 bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg border text-xs font-bold">
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

      <div className="border-border/60 overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategori</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">USP</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analyses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-10 text-center"
                >
                  <BarChart3 className="mx-auto mb-2 size-8 opacity-40" />
                  Belum ada analisis USP. Buat analisis untuk kategori produk.
                </TableCell>
              </TableRow>
            ) : (
              analyses.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link
                      href={`/research-hub/usp-analyzer/${a.id}`}
                      className="font-medium hover:underline"
                    >
                      {a.category}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        statusTone(a.status),
                      )}
                    >
                      {USP_GAP_STATUS_LABELS[a.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.uspCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.differentiationScore != null
                      ? Math.round(a.differentiationScore)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        disabled={pending}
                        onClick={() => handleRefresh(a.id)}
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-rose-600"
                        disabled={pending}
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
