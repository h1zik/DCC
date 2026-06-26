"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Layers, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { saveBrandPortfolioAction } from "@/actions/brand-portfolio";
import { actionErrorMessage } from "@/lib/action-error-message";
import { hub } from "@/components/brand-hub/brand-hub-primitives";
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
import { cn } from "@/lib/utils";

const ROLE_OPTIONS: { value: BrandPortfolioLineRole; label: string }[] = [
  { value: "HERO", label: "Hero — produk andalan" },
  { value: "CORE", label: "Core — lini utama" },
  { value: "FLANKER", label: "Flanker — pelengkap" },
  { value: "EXPERIMENTAL", label: "Eksperimental" },
];

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
      <div className={cn(hub.panel, "p-6 text-sm text-muted-foreground")}>
        Belum ada brand di sistem. Buat brand di Finance / Settings terlebih dahulu.
      </div>
    );
  }

  const brandName = brands.find((b) => b.id === brandId)?.name ?? "Brand";

  return (
    <div className={cn("flex flex-col gap-5", hub.entrance)}>
      <div className={cn(hub.panel, "flex flex-wrap items-center justify-between gap-3 p-4")}>
        <div>
          <p className="text-sm font-semibold">{brandName}</p>
          <p className="text-muted-foreground text-xs">
            Langkah 1: jelaskan produk apa saja yang akan dijual. Langkah 2: generate{" "}
            <Link
              href={`/brand-hub/strategy?brandId=${encodeURIComponent(brandId)}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Brand Strategy
            </Link>
            .
          </p>
        </div>
        <Button onClick={handleSave} disabled={pending}>
          <Save className="size-3.5" />
          Simpan portfolio
        </Button>
      </div>

      <section className={cn(hub.panel, "grid gap-4 p-4")}>
        <div className="flex items-center gap-2">
          <Layers className="text-primary size-4" />
          <h2 className="text-sm font-semibold">Ringkasan brand</h2>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Visi portfolio (opsional)</Label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Mis. Brand body care premium untuk perempuan urban 25–35 tahun, fokus brightening & self-care ritual…"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Lini produk</h2>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="size-3.5" />
            Tambah lini
          </Button>
        </div>

        {lines.map((line, index) => (
          <article
            key={line.id ?? `new-${index}`}
            className={cn(hub.panel, "grid gap-4 p-4 md:grid-cols-2")}
          >
            <div className="md:col-span-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Layers className="size-3.5" />
                Lini #{index + 1}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={lines.length <= 1}
                onClick={() => removeLine(index)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

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
          </article>
        ))}
      </section>
    </div>
  );
}
