"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FileUp, Link2, RefreshCw, Star } from "lucide-react";
import { toast } from "sonner";
import {
  createReviewIntelSource,
  createReviewIntelSourceFromCsv,
} from "@/actions/research-review-intelligence";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  REVIEW_PLATFORMS,
  reviewPlatformsByCategory,
} from "@/lib/review-platforms/platforms";
import type { SelectItemDef } from "@/lib/select-option-items";
import { MarketplaceLogo } from "@/components/research-hub/marketplace-logo";
import { lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

const PLATFORM_ITEMS: SelectItemDef[] = [
  ...reviewPlatformsByCategory("marketplace"),
  ...reviewPlatformsByCategory("community"),
].map((p) => ({ value: p.key, label: p.label }));

type Mode = "scrape" | "csv";

/**
 * Form tambah sumber review: scrape URL produk kompetitor atau import CSV.
 * Setelah berhasil, langsung pindah ke halaman detail sumber baru.
 */
export function ReviewSourceForm({
  id,
  onCancel,
  onCreated,
}: {
  id: string;
  /** Tidak ada tombol Batal bila undefined (mis. saat belum ada sumber). */
  onCancel?: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("scrape");
  const [productName, setProductName] = useState("");
  const [competitorBrand, setCompetitorBrand] = useState("");
  const [platformKey, setPlatformKey] = useState("shopee");
  const [productUrl, setProductUrl] = useState("");
  const [csvContent, setCsvContent] = useState("");

  const selectedPlatform = useMemo(
    () => REVIEW_PLATFORMS.find((p) => p.key === platformKey),
    [platformKey],
  );

  function resetForm() {
    setProductName("");
    setCompetitorBrand("");
    setProductUrl("");
    setCsvContent("");
    setPlatformKey("shopee");
    setMode("scrape");
  }

  function handleSubmit() {
    if (!productName.trim() || !competitorBrand.trim()) {
      toast.error("Isi nama produk dan brand kompetitor dulu.");
      return;
    }
    if (mode === "scrape" && !productUrl.trim()) {
      toast.error("Isi URL produk yang mau di-scrape.");
      return;
    }
    if (mode === "csv" && !csvContent.trim()) {
      toast.error("Pilih file CSV atau tempel isinya dulu.");
      return;
    }

    startTransition(async () => {
      try {
        const result =
          mode === "csv"
            ? await createReviewIntelSourceFromCsv({
                productName,
                competitorBrand,
                csvContent,
                productUrl:
                  productUrl.trim() || "https://manual-import.local/reviews",
              })
            : await createReviewIntelSource({
                productName,
                competitorBrand,
                platformKey,
                productUrl,
              });
        toast.success(
          mode === "csv"
            ? "Review diimpor dan dianalisis."
            : "Scrape dimulai. Review diambil di background.",
        );
        resetForm();
        onCreated();
        router.push(`/research-hub/review-intelligence/${result.id}`);
      } catch (err) {
        toast.error(
          actionErrorMessage(
            err,
            mode === "csv"
              ? "Impor CSV gagal. Periksa kolom text/review/ulasan."
              : "Scrape gagal dimulai. Periksa URL produk.",
          ),
        );
      }
    });
  }

  function handleCsvFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvContent(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        lab.panel,
        "grid gap-5",
        "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={`${id}-title`} className="rh-section-title">
            Tambah sumber review
          </h2>
          <p className="rh-lede">
            Scrape URL produk kompetitor, atau impor CSV review yang sudah Anda
            miliki.
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Cara menambah review"
          className="bg-muted/60 inline-flex items-center rounded-lg p-0.5"
        >
          {(
            [
              { value: "scrape", label: "Scrape URL", icon: Link2 },
              { value: "csv", label: "Impor CSV", icon: FileUp },
            ] as const
          ).map((opt) => {
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setMode(opt.value);
                  if (opt.value === "csv") setPlatformKey("csv");
                  else if (platformKey === "csv") setPlatformKey("shopee");
                }}
                className={cn(
                  "focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <opt.icon className="size-3.5" aria-hidden />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-product`}>Nama produk</Label>
          <Input
            id={`${id}-product`}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Mis. Body Lotion Brightening 200ml"
            disabled={pending}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-brand`}>Brand kompetitor</Label>
          <Input
            id={`${id}-brand`}
            value={competitorBrand}
            onChange={(e) => setCompetitorBrand(e.target.value)}
            placeholder="Mis. Brand X"
            disabled={pending}
          />
        </div>
      </div>

      {mode === "scrape" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-platform`}>Sumber review</Label>
            <Select
              value={platformKey}
              items={PLATFORM_ITEMS}
              onValueChange={(v) => {
                if (v) setPlatformKey(v);
              }}
            >
              <SelectTrigger id={`${id}-platform`}>
                <span className="inline-flex items-center gap-1.5">
                  <MarketplaceLogo marketplace={platformKey} className="size-4" />
                  {selectedPlatform?.label ?? platformKey}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Marketplace</SelectLabel>
                  {reviewPlatformsByCategory("marketplace").map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      <span className="inline-flex items-center gap-1.5">
                        <MarketplaceLogo marketplace={p.key} className="size-4" />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Komunitas</SelectLabel>
                  {reviewPlatformsByCategory("community").map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      <span className="inline-flex items-center gap-1.5">
                        <MarketplaceLogo marketplace={p.key} className="size-4" />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-url`}>URL produk</Label>
            <Input
              id={`${id}-url`}
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder={selectedPlatform?.urlPlaceholder ?? "https://..."}
              disabled={pending}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-csv-file`}>File CSV</Label>
            <Input
              id={`${id}-csv-file`}
              type="file"
              accept=".csv,text/csv"
              aria-describedby={`${id}-csv-hint`}
              onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
            />
            <p id={`${id}-csv-hint`} className="rh-meta">
              Kolom wajib: text, review, atau ulasan. Opsional: rating, author,
              date.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-csv-paste`}>Atau tempel CSV</Label>
            <Textarea
              id={`${id}-csv-paste`}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              rows={5}
              placeholder={'text,rating,author\n"Tekstur enak",5,Sari'}
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-csv-url`}>URL referensi (opsional)</Label>
            <Input
              id={`${id}-csv-url`}
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://reviews.femaledaily.com/products/..."
              disabled={pending}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="rh-meta">
          {mode === "scrape"
            ? "Review di-scrape lalu dianalisis AI: sentimen, keluhan, pujian, dan gap opportunity."
            : "Review dari CSV langsung dianalisis tanpa scraping."}
        </p>
        <div className="flex items-center gap-3">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              Batal
            </Button>
          ) : null}
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? (
              <RefreshCw className="animate-spin" aria-hidden />
            ) : mode === "csv" ? (
              <FileUp aria-hidden />
            ) : (
              <Star aria-hidden />
            )}
            {pending
              ? "Memulai…"
              : mode === "csv"
                ? "Impor dan analisis"
                : "Scrape review"}
          </Button>
        </div>
      </div>
    </section>
  );
}
