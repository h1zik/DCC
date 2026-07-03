"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FlaskConical, GitCompare, Plus, Trash2 } from "lucide-react";
import {
  ProductConceptMode,
  ProductConceptStatus,
} from "@prisma/client";
import { toast } from "sonner";
import {
  createProductConcept,
  deleteProductConcept,
} from "@/actions/research-concept-lab";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  PRODUCT_CONCEPT_MODE_LABELS,
  PRODUCT_CONCEPT_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import {
  hub,
  ResearchHubEmptyState,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

export type ConceptRow = {
  id: string;
  title: string;
  category: string;
  mode: ProductConceptMode;
  status: ProductConceptStatus;
  overallScore: number | null;
  decision: string | null;
  uspGapAnalysisId: string | null;
  createdAt: string;
};

function statusChipTone(
  status: ProductConceptStatus,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "SENT_TO_RND":
      return "primary";
    case "VALIDATING":
      return "warning";
    case "ARCHIVED":
      return "neutral";
    default:
      return "neutral";
  }
}

function decisionChipTone(
  decision: string | null,
): "neutral" | "success" | "warning" | "primary" {
  switch (decision) {
    case "GO":
      return "success";
    case "NO_GO":
      return "warning";
    case "PIVOT":
      return "primary";
    default:
      return "neutral";
  }
}

export function ConceptLabClient({ concepts }: { concepts: ConceptRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<ProductConceptMode>(
    ProductConceptMode.AI_GENERATED,
  );
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const hasInProgress = concepts.some((c) => c.status === "VALIDATING");
  const filtered = showArchived
    ? concepts
    : concepts.filter((c) => c.status !== "ARCHIVED");
  const readyCount = concepts.filter((c) => c.status === "READY").length;
  const goCount = concepts.filter((c) => c.decision === "GO").length;
  const fromUspCount = concepts.filter((c) => c.uspGapAnalysisId).length;

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  function handleCreate() {
    if (!title.trim() || !category.trim()) {
      toast.error("Isi judul dan kategori.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductConcept({
          mode,
          title,
          category,
          targetMarket: targetMarket || undefined,
          priceTargetMin: priceMin ? Number(priceMin) : undefined,
          priceTargetMax: priceMax ? Number(priceMax) : undefined,
        });
        toast.success(
          mode === ProductConceptMode.AI_GENERATED
            ? "Konsep AI sedang dibuat."
            : "Konsep draft dibuat.",
        );
        setDialogOpen(false);
        router.push(`/research-hub/concept-lab/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat konsep."));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus konsep ini?")) return;
    startTransition(async () => {
      try {
        await deleteProductConcept(id);
        toast.success("Konsep dihapus.");
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
            label="Konsep"
            value={concepts.length.toLocaleString("id-ID")}
            tone="primary"
          />
          <ResearchHubStatChip
            label="Siap"
            value={readyCount.toLocaleString("id-ID")}
            tone="success"
          />
          <ResearchHubStatChip
            label="GO"
            value={goCount.toLocaleString("id-ID")}
          />
          <ResearchHubStatChip
            label="Dari USP"
            value={fromUspCount.toLocaleString("id-ID")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showArchived}
              onCheckedChange={(v) => setShowArchived(!!v)}
            />
            Arsip
          </label>
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/research-hub/concept-lab/compare" />}
          >
            <GitCompare className="mr-1.5 size-3.5" aria-hidden />
            Bandingkan
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" aria-hidden />
                  Konsep Baru
                </Button>
              }
            />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Konsep Produk Baru</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select
                    value={mode}
                    onValueChange={(v) => v && setMode(v as ProductConceptMode)}
                  >
                    <SelectTrigger />
                    <SelectContent>
                      <SelectItem value={ProductConceptMode.AI_GENERATED}>
                        AI Generate
                      </SelectItem>
                      <SelectItem value={ProductConceptMode.MANUAL}>
                        Manual
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Judul konsep</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="body serum brightening"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target market</Label>
                  <Input
                    value={targetMarket}
                    onChange={(e) => setTargetMarket(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Harga min</Label>
                    <Input
                      type="number"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Harga max</Label>
                    <Input
                      type="number"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={pending}>
                  {mode === ProductConceptMode.AI_GENERATED
                    ? "Generate"
                    : "Buat Draft"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {hasInProgress ? (
        <div className={hub.entrance}>
          <JobProgressBar
            title="Generate & validasi konsep berjalan"
            percent={55}
            stepLabel="AI sedang membangun konsep lalu menjalankan validator skor."
          />
        </div>
      ) : null}

      <ResearchHubSection
        title="Konsep Produk"
        description="Bangun dan validasi konsep siap brief ke R&D — manual atau AI generate."
      >
        {filtered.length === 0 ? (
          <ResearchHubEmptyState
            icon={FlaskConical}
            title="Belum ada konsep produk"
            description="Buat konsep manual atau AI generate. Konsep dari USP Analyzer otomatis membawa konteks riset."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Konsep Baru
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((c, index) => (
              <div
                key={c.id}
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
                      href={`/research-hub/concept-lab/${c.id}`}
                      className="hover:text-primary line-clamp-2 text-base font-semibold transition-colors duration-150 motion-reduce:transition-none"
                    >
                      {c.title}
                    </Link>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {c.category} · {PRODUCT_CONCEPT_MODE_LABELS[c.mode]}
                    </p>
                    {c.uspGapAnalysisId ? (
                      <Link
                        href={`/research-hub/usp-analyzer/${c.uspGapAnalysisId}`}
                        className="text-primary mt-0.5 inline-block text-[10px] hover:underline"
                      >
                        Dari USP Analyzer
                      </Link>
                    ) : null}
                  </div>
                  <ResearchHubStatChip
                    label="Status"
                    value={PRODUCT_CONCEPT_STATUS_LABELS[c.status]}
                    tone={statusChipTone(c.status)}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ResearchHubStatChip
                    label="Score"
                    value={
                      c.overallScore != null
                        ? Math.round(c.overallScore).toLocaleString("id-ID")
                        : "—"
                    }
                    tone="primary"
                  />
                  {c.decision ? (
                    <ResearchHubStatChip
                      label="Keputusan"
                      value={c.decision}
                      tone={decisionChipTone(c.decision)}
                    />
                  ) : null}
                  <ResearchHubStatChip
                    label="Dibuat"
                    value={formatRelativeTime(new Date(c.createdAt))}
                  />
                </div>

                <div className="mt-3 flex gap-1 border-t border-border/40 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => handleDelete(c.id)}
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
