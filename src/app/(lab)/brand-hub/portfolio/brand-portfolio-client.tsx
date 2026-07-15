"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Layers, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { saveBrandPortfolioAction } from "@/actions/brand-portfolio";
import { actionErrorMessage } from "@/lib/action-error-message";
import { lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BrandPortfolioLineInput,
  BrandPortfolioLineRole,
  BrandPortfolioView,
  ProductDiscoveryOption,
} from "@/lib/brand-research/portfolio/types";
import type { SelectItemDef } from "@/lib/select-option-items";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS: { value: BrandPortfolioLineRole; label: string }[] = [
  { value: "HERO", label: "Hero — produk andalan" },
  { value: "CORE", label: "Core — lini utama" },
  { value: "FLANKER", label: "Flanker — pelengkap" },
  { value: "EXPERIMENTAL", label: "Eksperimental" },
];

const ROLE_ITEMS: SelectItemDef[] = ROLE_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
}));

/** Pill peran lini — tinted per peran, senada skin bento. */
const ROLE_PILL: Record<BrandPortfolioLineRole, string> = {
  HERO: "bg-pink-500/12 text-pink-700 dark:text-pink-300",
  CORE: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
  FLANKER: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  EXPERIMENTAL: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
};

const ROLE_SHORT: Record<BrandPortfolioLineRole, string> = {
  HERO: "Hero",
  CORE: "Core",
  FLANKER: "Flanker",
  EXPERIMENTAL: "Eksperimental",
};

function emptyLine(): BrandPortfolioLineInput {
  return {
    name: "",
    category: "",
    description: "",
    targetAudience: "",
    role: "CORE",
    productDiscoveryQueryId: null,
  };
}

export function BrandPortfolioClient({
  brands,
  brandId,
  portfolio,
  discoveryOptions,
}: {
  brands: { id: string; name: string }[];
  brandId: string | null;
  portfolio: BrandPortfolioView | null;
  discoveryOptions: ProductDiscoveryOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState(portfolio?.summary ?? "");
  const discoveryItems = useMemo<SelectItemDef[]>(
    () => [
      { value: "none", label: "— Tidak dihubungkan —" },
      ...discoveryOptions.map((q) => ({
        value: q.id,
        label: `${q.label}${q.detail ? ` · ${q.detail}` : ""}`,
      })),
    ],
    [discoveryOptions],
  );
  const [lines, setLines] = useState<BrandPortfolioLineInput[]>(
    portfolio?.lines.length
      ? portfolio.lines.map((line) => ({
          id: line.id,
          name: line.name,
          category: line.category ?? "",
          description: line.description ?? "",
          targetAudience: line.targetAudience ?? "",
          role: line.role ?? "CORE",
          productDiscoveryQueryId: line.productDiscoveryQueryId ?? null,
          sortOrder: line.sortOrder,
        }))
      : [emptyLine()],
  );

  function updateLine(index: number, patch: Partial<BrandPortfolioLineInput>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function handleSave() {
    if (!brandId) {
      toast.error("Pilih brand terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      try {
        await saveBrandPortfolioAction({
          brandId,
          summary: summary.trim() || null,
          lines: lines.map((line, index) => ({
            ...line,
            name: line.name.trim(),
            sortOrder: index,
          })),
        });
        toast.success("Brand Portfolio disimpan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan portfolio."));
      }
    });
  }

  if (!brandId) {
    return (
      <div className="bento-tile text-muted-foreground justify-start p-6 text-sm">
        Belum ada brand di sistem. Buat brand di Finance / Settings terlebih dahulu.
      </div>
    );
  }

  const brandName = brands.find((b) => b.id === brandId)?.name ?? "Brand";

  // Agregat murah dari state yang sedang diedit — tanpa query tambahan.
  const totalLines = lines.length;
  const heroCount = lines.filter((l) => l.role === "HERO").length;
  const coreCount = lines.filter((l) => l.role === "CORE").length;
  const linkedCount = lines.filter((l) => l.productDiscoveryQueryId).length;
  const completeCount = lines.filter(
    (l) =>
      l.name.trim() &&
      (l.category ?? "").trim() &&
      (l.description ?? "").trim(),
  ).length;

  return (
    <div className={cn("flex flex-col gap-5", lab.entrance)}>
      {/* Papan bento ringkasan portfolio */}
      <div className="grid auto-rows-[6.75rem] grid-cols-2 gap-3 md:grid-cols-4">
        <div className="bento-tile border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
          <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
            Lini produk
          </span>
          <span className="bento-value text-white dark:text-pink-950">
            {totalLines}
          </span>
          <span className="truncate text-[11px] font-medium text-pink-100/90 dark:text-pink-900/80">
            di portfolio {brandName}
          </span>
        </div>

        <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
          <span className="text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
            Hero · Core
          </span>
          <span className="bento-value text-pink-900 dark:text-pink-300">
            {heroCount}
            <span className="text-lg font-bold text-pink-900/50 dark:text-pink-300/50">
              {" "}
              / {coreCount}
            </span>
          </span>
          <span className="text-[11px] font-medium text-pink-900/60 dark:text-pink-200/50">
            produk andalan & lini utama
          </span>
        </div>

        <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
          <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
            Terhubung riset
          </span>
          <span className="bento-value text-amber-900 dark:text-amber-300">
            {linkedCount}
          </span>
          <span className="text-[11px] font-medium text-amber-900/60 dark:text-amber-200/50">
            lini dengan query Product Discovery
          </span>
        </div>

        <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
          <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
            Profil lengkap
          </span>
          <span className="bento-value text-violet-950 dark:text-violet-300">
            {completeCount}
            <span className="text-lg font-bold text-violet-950/50 dark:text-violet-300/50">
              /{totalLines}
            </span>
          </span>
          <span className="text-[11px] font-medium text-violet-950/60 dark:text-violet-300/50">
            nama, kategori & deskripsi terisi
          </span>
        </div>
      </div>

      {/* Bar brand + simpan */}
      <div className="bento-tile gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/12 text-pink-700 dark:text-pink-300"
            aria-hidden
          >
            <Layers className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight">{brandName}</p>
            <p className="text-muted-foreground text-xs">
              Langkah 1: jelaskan produk apa saja yang akan dijual. Langkah 2: generate{" "}
              <Link
                href={`/brand-hub/strategy?brandId=${encodeURIComponent(brandId)}`}
                className="text-[var(--lab-accent,var(--primary))] underline-offset-2 hover:underline"
              >
                Brand Strategy
              </Link>
              .
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={pending} className="shrink-0">
          <Save className="size-3.5" />
          Simpan portfolio
        </Button>
      </div>

      {/* Visi portfolio */}
      <section className="bento-tile justify-start gap-3">
        <div>
          <span className="bento-label">Visi portfolio</span>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Opsional — gambaran besar arah portfolio brand ini.
          </p>
        </div>
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          placeholder="Mis. Brand body care premium untuk perempuan urban 25–35 tahun, fokus brightening & self-care ritual…"
        />
      </section>

      {/* Daftar lini produk */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className={lab.sectionTitle}>Lini produk</h2>
            <p className={lab.sectionDesc}>
              {totalLines} lini · {completeCount} profil lengkap
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="size-3.5" />
            Tambah lini
          </Button>
        </div>

        {lines.map((line, index) => {
          const role = (line.role ?? "CORE") as BrandPortfolioLineRole;
          return (
            <article
              key={line.id ?? `new-${index}`}
              className="bento-tile justify-start gap-4"
            >
              {/* Header kartu lini */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/12 text-sm font-extrabold tabular-nums text-pink-700 dark:text-pink-300"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold tracking-tight">
                      {line.name.trim() || `Lini #${index + 1}`}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {(line.category ?? "").trim() || "Kategori belum diisi"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      ROLE_PILL[role],
                    )}
                  >
                    {ROLE_SHORT[role]}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={lines.length <= 1}
                    onClick={() => removeLine(index)}
                    aria-label={`Hapus lini ${index + 1}`}
                  >
                    <Trash2 className="text-destructive size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Nama produk / lini *</Label>
                  <Input
                    value={line.name}
                    onChange={(e) => updateLine(index, { name: e.target.value })}
                    placeholder="mis. Body Serum Brightening"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Kategori</Label>
                  <Input
                    value={line.category ?? ""}
                    onChange={(e) => updateLine(index, { category: e.target.value })}
                    placeholder="mis. body serum"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Peran di portfolio</Label>
                  <Select
                    value={line.role ?? "CORE"}
                    items={ROLE_ITEMS}
                    onValueChange={(v) =>
                      updateLine(index, { role: v as BrandPortfolioLineRole })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Target audiens</Label>
                  <Input
                    value={line.targetAudience ?? ""}
                    onChange={(e) => updateLine(index, { targetAudience: e.target.value })}
                    placeholder="mis. perempuan 20–30, concern kulit kusam"
                  />
                </div>

                <div className="grid gap-1.5 md:col-span-2">
                  <Label className="text-xs">Deskripsi singkat</Label>
                  <Textarea
                    value={line.description ?? ""}
                    onChange={(e) => updateLine(index, { description: e.target.value })}
                    rows={2}
                    placeholder="Apa yang dijual, benefit utama, diferensiasi yang direncanakan…"
                  />
                </div>

                <div className="grid gap-1.5 md:col-span-2">
                  <Label className="text-xs">Product Discovery (opsional)</Label>
                  <Select
                    value={line.productDiscoveryQueryId ?? "none"}
                    items={discoveryItems}
                    onValueChange={(v) =>
                      updateLine(index, {
                        productDiscoveryQueryId: v === "none" ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Hubungkan query discovery pasar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Tidak dihubungkan —</SelectItem>
                      {discoveryOptions.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.label}
                          {q.detail ? ` · ${q.detail}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-[10px]">
                    Data pasar dari Research Hub Product Discovery otomatis masuk ke Brand Strategy
                    saat generate.
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
