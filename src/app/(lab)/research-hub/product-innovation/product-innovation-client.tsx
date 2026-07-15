"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowUpRight,
  Lightbulb,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ProductInnovationStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  createProductInnovation,
  deleteProductInnovation,
} from "@/actions/research-product-innovation";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
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

/** Pill status tinted ala bento. */
function StatusPill({ status }: { status: ProductInnovationStatus }) {
  const tone =
    status === "READY"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "GENERATING"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : status === "FAILED"
          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      {status === "GENERATING" ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : null}
      {STATUS_LABELS[status]}
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
  const [formOpen, setFormOpen] = useState(innovations.length === 0);
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
  const generatingCount = innovations.filter(
    (i) => i.status === "GENERATING",
  ).length;
  const promotedTotal = innovations.reduce((n, i) => n + i.promotedCount, 0);
  const ideasTotal = innovations.reduce((n, i) => n + i.ideaCount, 0);

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
        setFormOpen(false);
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
      {/* Strip ringkasan bento */}
      {innovations.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Sesi inovasi
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {innovations.length}
            </span>
            <span className="text-[11px] font-medium text-violet-100/90 dark:text-violet-900/80">
              {readyCount} siap · 6 lensa SCAMPER per sesi
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Ide dihasilkan</span>
            <span className="bento-value">{ideasTotal}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              alternatif inovasi berbasis evidence
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Dipromosikan
            </span>
            <span className="bento-value text-violet-900 dark:text-violet-300">
              {promotedTotal}
            </span>
            <span className="text-[11px] font-medium text-violet-700/70 dark:text-violet-300/70">
              jadi konsep di Concept Lab
            </span>
          </div>

          <div
            className={cn(
              "bento-tile",
              generatingCount > 0
                ? "border-transparent bg-[#ffedcd] dark:bg-amber-400/10"
                : undefined,
            )}
          >
            <span
              className={cn(
                generatingCount > 0
                  ? "text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60"
                  : "bento-label",
              )}
            >
              Sedang dibuat
            </span>
            <span
              className={cn(
                "bento-value",
                generatingCount > 0 && "text-amber-900 dark:text-amber-300",
              )}
            >
              {generatingCount}
            </span>
            <span
              className={cn(
                "text-[11px] font-medium",
                generatingCount > 0
                  ? "text-amber-800/70 dark:text-amber-200/60"
                  : "text-muted-foreground",
              )}
            >
              {generatingCount > 0
                ? "halaman refresh otomatis"
                : "tidak ada job berjalan"}
            </span>
          </div>
        </div>
      ) : null}

      {/* Daftar sesi + form collapsible */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Sesi Inovasi</h2>
            <p className={lab.sectionDesc}>
              {innovations.length === 0
                ? "Mulai sesi SCAMPER pertama Anda di bawah."
                : `${innovations.length} sesi · tiap sesi menerapkan 6 lensa SCAMPER, di-grounding evidence riset.`}
            </p>
          </div>
          <Button
            size="sm"
            variant={formOpen ? "outline" : "default"}
            onClick={() => setFormOpen((v) => !v)}
          >
            {formOpen ? (
              <X className="mr-1.5 size-3.5" aria-hidden />
            ) : (
              <Plus className="mr-1.5 size-3.5" aria-hidden />
            )}
            {formOpen ? "Tutup" : "Inovasi Baru"}
          </Button>
        </div>

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
                Sesi SCAMPER baru
              </p>
              <p className="text-muted-foreground text-sm">
                Tentukan produk basis — AI menerapkan 6 lensa SCAMPER dengan
                evidence dari modul riset yang dipilih.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {baseConcepts.length > 0 ? (
                <div className="grid gap-1.5">
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
              <div className="grid gap-1.5">
                <Label>Produk basis</Label>
                <Input
                  value={baseProduct}
                  onChange={(e) => setBaseProduct(e.target.value)}
                  placeholder="mis. Eau de parfum floral 50ml"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="parfum"
                  disabled={pending}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Target market</Label>
                <Input
                  value={targetMarket}
                  onChange={(e) => setTargetMarket(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Harga min</Label>
                <Input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Harga max</Label>
                <Input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Ide terbaik bisa dipromosikan langsung menjadi konsep.
              </p>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 size-3.5" aria-hidden />
                )}
                Generate SCAMPER
              </Button>
            </div>
          </div>
        ) : null}

        {innovations.length === 0 ? (
          formOpen ? null : (
            <LabEmptyState
              icon={Lightbulb}
              title="Belum ada sesi inovasi"
              description="Mulai sesi SCAMPER dari produk basis atau konsep yang sudah ada."
              action={
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  Inovasi Baru
                </Button>
              }
            />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {innovations.map((i) => (
              <div
                key={i.id}
                className={cn(lab.card, "group flex flex-col p-0")}
              >
                <Link
                  href={`/research-hub/product-innovation/${i.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
                        aria-hidden
                      >
                        <Lightbulb className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{i.baseProduct}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {i.category}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={i.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <CardStat
                      label="Ide"
                      value={i.ideaCount.toLocaleString("id-ID")}
                    />
                    <CardStat
                      label="Promosi"
                      value={
                        i.promotedCount > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {i.promotedCount.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <CardStat
                      label="Dibuat"
                      value={formatRelativeTime(new Date(i.createdAt))}
                    />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <Lightbulb className="size-3.5" aria-hidden />
                    SCAMPER · 6 lensa
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    onClick={() => handleDelete(i.id)}
                    aria-label="Hapus sesi"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
