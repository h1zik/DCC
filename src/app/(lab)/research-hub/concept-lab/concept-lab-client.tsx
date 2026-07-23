"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowUpRight,
  FlaskConical,
  GitCompare,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
import type { SelectItemDef } from "@/lib/select-option-items";
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

const CONCEPT_MODE_ITEMS: SelectItemDef[] = [
  {
    value: ProductConceptMode.AI_GENERATED,
    label: PRODUCT_CONCEPT_MODE_LABELS[ProductConceptMode.AI_GENERATED],
  },
  {
    value: ProductConceptMode.MANUAL,
    label: PRODUCT_CONCEPT_MODE_LABELS[ProductConceptMode.MANUAL],
  },
];

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

/** Pill status tinted ala bento. */
function StatusPill({ status }: { status: ProductConceptStatus }) {
  const tone =
    status === "READY"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "VALIDATING"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : status === "SENT_TO_RND"
          ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      {PRODUCT_CONCEPT_STATUS_LABELS[status]}
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

function decisionValueClass(decision: string | null): string {
  switch (decision) {
    case "GO":
      return "text-emerald-600 dark:text-emerald-400";
    case "NO_GO":
      return "text-rose-600 dark:text-rose-400";
    case "PIVOT":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "";
  }
}

export function ConceptLabClient({ concepts }: { concepts: ConceptRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(concepts.length === 0);
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
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
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
        setFormOpen(false);
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
      {/* Strip ringkasan bento */}
      {concepts.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Total konsep
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {concepts.length}
            </span>
            <span className="text-[11px] font-medium text-violet-100/90 dark:text-violet-900/80">
              {readyCount} siap brief · {fromUspCount} dari USP Analyzer
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Siap brief</span>
            <span className="bento-value">{readyCount}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              tervalidasi & siap ke R&D
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Keputusan GO
            </span>
            <span className="bento-value text-violet-900 dark:text-violet-300">
              {goCount}
            </span>
            <span className="text-[11px] font-medium text-violet-700/70 dark:text-violet-300/70">
              lolos validasi AI
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Dari USP Analyzer</span>
            <span className="bento-value">{fromUspCount}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              membawa konteks riset
            </span>
          </div>
        </div>
      ) : null}

      {hasInProgress ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="Generate & validasi konsep berjalan"
            percent={55}
            stepLabel="AI sedang membangun konsep lalu menjalankan validator skor."
          />
        </div>
      ) : null}

      {/* Daftar konsep + form collapsible */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Konsep Produk</h2>
            <p className={lab.sectionDesc}>
              {concepts.length === 0
                ? "Mulai dengan konsep pertama Anda di bawah."
                : `${filtered.length} konsep ditampilkan · manual atau AI generate.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-muted-foreground flex items-center gap-2 text-sm">
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
              {formOpen ? "Tutup" : "Konsep Baru"}
            </Button>
          </div>
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
                Konsep produk baru
              </p>
              <p className="text-muted-foreground text-sm">
                AI generate membangun konsep lengkap dari kategori; mode manual
                mulai dari draft kosong.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Mode</Label>
                <Select
                  value={mode}
                  items={CONCEPT_MODE_ITEMS}
                  onValueChange={(v) => v && setMode(v as ProductConceptMode)}
                >
                  <SelectTrigger>
                    {PRODUCT_CONCEPT_MODE_LABELS[mode]}
                  </SelectTrigger>
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
              <div className="grid gap-1.5">
                <Label>Judul konsep</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="mis. Serum brightening low-irritation"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="body serum brightening"
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Konsep dari USP Analyzer otomatis membawa konteks riset.
              </p>
              <Button onClick={handleCreate} disabled={pending}>
                <Plus className="mr-1.5 size-3.5" aria-hidden />
                {mode === ProductConceptMode.AI_GENERATED
                  ? "Generate"
                  : "Buat Draft"}
              </Button>
            </div>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          formOpen ? null : (
            <LabEmptyState
              icon={FlaskConical}
              title="Belum ada konsep produk"
              description="Buat konsep manual atau AI generate. Konsep dari USP Analyzer otomatis membawa konteks riset."
              action={
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  Konsep Baru
                </Button>
              }
            />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <div
                key={c.id}
                className={cn(lab.card, "group flex flex-col p-0")}
              >
                <Link
                  href={`/research-hub/concept-lab/${c.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold uppercase"
                        aria-hidden
                      >
                        {c.title.trim().charAt(0) || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{c.title}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {c.category} · {PRODUCT_CONCEPT_MODE_LABELS[c.mode]}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={c.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <CardStat
                      label="Skor"
                      value={
                        c.overallScore != null
                          ? Math.round(c.overallScore).toLocaleString("id-ID")
                          : "—"
                      }
                    />
                    <CardStat
                      label="Keputusan"
                      value={
                        c.decision ? (
                          <span className={decisionValueClass(c.decision)}>
                            {c.decision}
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <CardStat
                      label="Dibuat"
                      value={formatRelativeTime(new Date(c.createdAt))}
                    />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  {c.uspGapAnalysisId ? (
                    <Link
                      href={`/research-hub/usp-analyzer/${c.uspGapAnalysisId}`}
                      className="text-primary text-xs font-semibold hover:underline"
                    >
                      Dari USP Analyzer →
                    </Link>
                  ) : (
                    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                      <FlaskConical className="size-3.5" aria-hidden />
                      Concept Lab
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    onClick={() => handleDelete(c.id)}
                    aria-label="Hapus konsep"
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
