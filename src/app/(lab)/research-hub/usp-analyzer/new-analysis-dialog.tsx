"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BarChart3, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  createUspGapAnalysis,
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ContextModuleToggles,
  ContextSourceIds,
  UspContextSourceOptions,
} from "@/lib/research/usp-gap/context-types";
import type { AvailableContextModules } from "@/lib/research/usp-gap/gather-context";

function defaultModules(available: AvailableContextModules): ContextModuleToggles {
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

/** Form analisis baru: kategori + pilihan modul/sumber konteks. */
export function NewUspAnalysisDialog({
  open,
  onOpenChange,
  availableModules,
  sourceOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableModules: AvailableContextModules;
  sourceOptions: UspContextSourceOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suggestPending, setSuggestPending] = useState(false);
  const [category, setCategory] = useState("");
  const [modules, setModules] = useState<ContextModuleToggles>(() =>
    defaultModules(availableModules),
  );
  const [selections, setSelections] = useState<ContextSourceIds>({});

  function reset() {
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
      toast.error("Isi kategori produk dulu.");
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
        toast.success("Sumber yang disarankan sudah dipilih.");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Saran sumber gagal diambil. Pilih sumber secara manual."));
      } finally {
        setSuggestPending(false);
      }
    });
  }

  function handleCreate() {
    if (!category.trim()) {
      toast.error("Isi kategori produk, mis. \"body serum brightening\".");
      return;
    }

    const contextModules = { ...modules, ...selections };

    startTransition(async () => {
      try {
        const result = await createUspGapAnalysis({
          category: category.trim(),
          contextModules,
        });
        toast.success("Analisis dimulai.");
        onOpenChange(false);
        reset();
        router.push(`/research-hub/usp-analyzer/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Analisis gagal dimulai."));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-border/60 space-y-1 border-b px-6 py-5">
          <DialogTitle className="text-base font-semibold">Analisis USP baru</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Gabungkan temuan dari modul riset, lalu AI menyusun gap matrix,
            positioning map, dan kandidat USP.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid gap-1.5">
            <Label htmlFor="usp-category">Kategori produk</Label>
            <div className="flex gap-2">
              <Input
                id="usp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder='Mis. "body serum brightening"'
                aria-describedby="usp-category-hint"
                disabled={pending}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={suggestPending || pending || !category.trim()}
                onClick={applySuggestions}
              >
                {suggestPending ? (
                  <RefreshCw className="animate-spin" aria-hidden />
                ) : (
                  <Sparkles aria-hidden />
                )}
                Sarankan sumber
              </Button>
            </div>
            <p id="usp-category-hint" className="rh-meta">
              Sarankan sumber memilih data riset yang paling relevan dengan kategori ini.
            </p>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Sumber data</legend>
            <UspContextSourcePicker
              options={sourceOptions}
              available={availableModules}
              modules={modules}
              selections={selections}
              onToggleModule={toggleModule}
              onSelectionsChange={setSelections}
            />
          </fieldset>
        </div>

        <DialogFooter className="border-border/60 bg-muted/15 flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full min-w-0 sm:flex-1">
            <p className="rh-meta mb-1.5">Modul aktif</p>
            <UspModuleSummaryChips modules={modules} available={availableModules} />
          </div>
          <Button
            className="w-full shrink-0 sm:w-auto"
            onClick={handleCreate}
            disabled={pending || !category.trim()}
          >
            {pending && !suggestPending ? (
              <RefreshCw className="animate-spin" aria-hidden />
            ) : (
              <BarChart3 aria-hidden />
            )}
            {pending && !suggestPending ? "Memulai…" : "Jalankan analisis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
