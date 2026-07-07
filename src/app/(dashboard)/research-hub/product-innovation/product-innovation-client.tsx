"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Lightbulb, Plus, Trash2 } from "lucide-react";
import { ProductInnovationStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  createProductInnovation,
  deleteProductInnovation,
} from "@/actions/research-product-innovation";
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
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime } from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import {
  hub,
  ResearchHubEmptyState,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

export type InnovationRow = {
  id: string;
  title: string;
  baseProduct: string;
  category: string;
  status: ProductInnovationStatus;
  ideaCount: number;
  promotedCount: number;
  createdAt: string;
};

export type BaseConceptOption = {
  id: string;
  title: string;
  category: string;
};

const STATUS_LABELS: Record<ProductInnovationStatus, string> = {
  DRAFT: "Draft",
  GENERATING: "Membuat…",
  READY: "Siap",
  FAILED: "Gagal",
};

function statusTone(
  status: ProductInnovationStatus,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "GENERATING":
      return "warning";
    case "FAILED":
      return "warning";
    default:
      return "neutral";
  }
}

const MODULE_OPTIONS = [
  { key: "reviewIntel", label: "Review Intel" },
  { key: "competitor", label: "Competitor" },
  { key: "trendRadar", label: "Trend Radar" },
  { key: "keywordIntel", label: "Keyword Intel" },
  { key: "socialListening", label: "Social Listening" },
] as const;

type ModuleKey = (typeof MODULE_OPTIONS)[number]["key"];

export function ProductInnovationClient({
  innovations,
  baseConcepts,
}: {
  innovations: InnovationRow[];
  baseConcepts: BaseConceptOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [baseProduct, setBaseProduct] = useState("");
  const [category, setCategory] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [baseConceptId, setBaseConceptId] = useState<string>("none");
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    reviewIntel: true,
    competitor: true,
    trendRadar: true,
    keywordIntel: true,
    socialListening: true,
  });

  const hasInProgress = innovations.some((i) => i.status === "GENERATING");
  const readyCount = innovations.filter((i) => i.status === "READY").length;
  const promotedTotal = innovations.reduce((n, i) => n + i.promotedCount, 0);

  const baseConceptItems = useMemo(
    (): SelectItemDef[] => [
      { value: "none", label: "Tanpa basis konsep" },
      ...baseConcepts.map((c) => ({ value: c.id, label: c.title })),
    ],
    [baseConcepts],
  );

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  function applyConcept(value: string | null) {
    const id = value ?? "none";
    setBaseConceptId(id);
    if (id !== "none") {
      const concept = baseConcepts.find((c) => c.id === id);
      if (concept) {
        if (!baseProduct.trim()) setBaseProduct(concept.title);
        if (!category.trim()) setCategory(concept.category);
      }
    }
  }

  function handleCreate() {
    if (!baseProduct.trim() || !category.trim()) {
      toast.error("Isi produk basis dan kategori.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductInnovation({
          baseProduct,
          category,
          targetMarket: targetMarket || undefined,
          priceTargetMin: priceMin ? Number(priceMin) : undefined,
          priceTargetMax: priceMax ? Number(priceMax) : undefined,
          baseConceptId: baseConceptId !== "none" ? baseConceptId : undefined,
          sourceModules: modules,
        });
        toast.success("Inovasi SCAMPER sedang dibuat.");
        setDialogOpen(false);
        router.push(`/research-hub/product-innovation/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat inovasi."));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus sesi inovasi ini?")) return;
    startTransition(async () => {
      try {
        await deleteProductInnovation(id);
        toast.success("Sesi dihapus.");
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
            label="Sesi"
            value={innovations.length.toLocaleString("id-ID")}
            tone="primary"
          />
          <ResearchHubStatChip
            label="Siap"
            value={readyCount.toLocaleString("id-ID")}
            tone="success"
          />
          <ResearchHubStatChip
            label="Dipromosikan"
            value={promotedTotal.toLocaleString("id-ID")}
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 size-3.5" aria-hidden />
                Inovasi Baru
              </Button>
            }
          />
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Sesi SCAMPER Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {baseConcepts.length > 0 ? (
                <div className="space-y-2">
                  <Label>Basis dari konsep (opsional)</Label>
                  <Select
                    value={baseConceptId}
                    items={baseConceptItems}
                    onValueChange={applyConcept}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tanpa basis konsep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa basis konsep</SelectItem>
                      {baseConcepts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Produk basis</Label>
                <Input
                  value={baseProduct}
                  onChange={(e) => setBaseProduct(e.target.value)}
                  placeholder="mis. Eau de parfum floral 50ml"
                />
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="parfum"
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
              <div className="space-y-2">
                <Label>Sumber evidence</Label>
                <div className="flex flex-wrap gap-3">
                  {MODULE_OPTIONS.map((m) => (
                    <label
                      key={m.key}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      <Checkbox
                        checked={modules[m.key]}
                        onCheckedChange={(v) =>
                          setModules((prev) => ({ ...prev, [m.key]: !!v }))
                        }
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={pending}>
                Generate SCAMPER
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ResearchHubSection
        title="Sesi Inovasi"
        description="Tiap sesi menerapkan 6 lensa SCAMPER pada produk basis, di-grounding evidence riset."
      >
        {innovations.length === 0 ? (
          <ResearchHubEmptyState
            icon={Lightbulb}
            title="Belum ada sesi inovasi"
            description="Mulai sesi SCAMPER dari produk basis atau konsep yang sudah ada."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Inovasi Baru
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {innovations.map((i, index) => (
              <div
                key={i.id}
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
                      href={`/research-hub/product-innovation/${i.id}`}
                      className="hover:text-primary line-clamp-2 text-base font-semibold transition-colors duration-150 motion-reduce:transition-none"
                    >
                      {i.baseProduct}
                    </Link>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {i.category}
                    </p>
                  </div>
                  <ResearchHubStatChip
                    label="Status"
                    value={STATUS_LABELS[i.status]}
                    tone={statusTone(i.status)}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ResearchHubStatChip
                    label="Ide"
                    value={i.ideaCount.toLocaleString("id-ID")}
                    tone="primary"
                  />
                  <ResearchHubStatChip
                    label="Dipromosikan"
                    value={i.promotedCount.toLocaleString("id-ID")}
                  />
                  <ResearchHubStatChip
                    label="Dibuat"
                    value={formatRelativeTime(new Date(i.createdAt))}
                  />
                </div>

                <div className="mt-3 flex gap-1 border-t border-border/40 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => handleDelete(i.id)}
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
