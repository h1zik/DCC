"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ResearchMarketplace, ReviewIntelSourceStatus } from "@prisma/client";
import { FileUp, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBrandReviewIntelSource,
  createBrandReviewIntelSourceFromCsv,
  deleteBrandReviewIntelSource,
  rescrapeBrandReviewIntelSource,
} from "@/actions/brand-review-intelligence";
import { actionErrorMessage } from "@/lib/action-error-message";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { Button } from "@/components/ui/button";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getReviewPlatformLabel,
  REVIEW_PLATFORMS,
  reviewPlatformsByCategory,
} from "@/lib/review-platforms/platforms";
import type { SelectItemDef } from "@/lib/select-option-items";
import { SOURCE_STATUS_LABELS, formatRelativeTime } from "@/lib/research/labels";
import {
  BrandHubEmptyState,
  BrandHubSection,
  BrandHubStatChip,
  hub,
} from "@/components/brand-hub/brand-hub-primitives";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { cn } from "@/lib/utils";
import { useBrandReviewIntelPolling } from "./use-brand-review-intel-polling";

export type BrandReviewSourceRow = {
  id: string;
  productName: string;
  competitorBrand: string;
  platformKey: string;
  marketplace: ResearchMarketplace | null;
  productUrl: string;
  status: ReviewIntelSourceStatus;
  reviewCount: number;
  totalReviewsReported: number | null;
  reviewsComplete: boolean | null;
  lastAnalyzedAt: string | null;
  errorMessage: string | null;
};

const PLATFORM_ITEMS: SelectItemDef[] = [
  ...reviewPlatformsByCategory("marketplace"),
  ...reviewPlatformsByCategory("community"),
].map((p) => ({ value: p.key, label: p.label }));

function statusChipTone(
  status: ReviewIntelSourceStatus,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "SCRAPING":
    case "ANALYZING":
      return "warning";
    default:
      return "neutral";
  }
}

function isInProgress(status: ReviewIntelSourceStatus) {
  return status === "SCRAPING" || status === "ANALYZING";
}

function isPartial(row: BrandReviewSourceRow) {
  return (
    row.totalReviewsReported != null &&
    row.totalReviewsReported > row.reviewCount
  );
}

export function BrandReviewIntelClient({
  sources,
}: {
  sources: BrandReviewSourceRow[];
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"scrape" | "csv">("scrape");
  const [productName, setProductName] = useState("");
  const [competitorBrand, setCompetitorBrand] = useState("");
  const [platformKey, setPlatformKey] = useState("shopee");
  const [productUrl, setProductUrl] = useState("");
  const [csvContent, setCsvContent] = useState("");

  const selectedPlatform = useMemo(
    () => REVIEW_PLATFORMS.find((p) => p.key === platformKey),
    [platformKey],
  );

  const hasInProgress = sources.some((s) => isInProgress(s.status));
  const readyCount = sources.filter((s) => s.status === "READY").length;
  const totalReviews = sources.reduce((sum, s) => sum + s.reviewCount, 0);
  const partialCount = sources.filter(isPartial).length;

  useBrandReviewIntelPolling(hasInProgress);

  function resetForm() {
    setProductName("");
    setCompetitorBrand("");
    setProductUrl("");
    setCsvContent("");
    setPlatformKey("shopee");
    setMode("scrape");
  }

  async function handleCreateScrape() {
    let result;
    try {
      result = await new Promise<{ id: string }>((resolve, reject) => {
        startTransition(async () => {
          try {
            resolve(await createBrandReviewIntelSource({
              productName,
              competitorBrand,
              platformKey,
              productUrl,
            }));
          } catch (err) {
            reject(err);
          }
        });
      });
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      return;
    }
    toast.success(
      "Scrape dimulai di background. Halaman akan update otomatis.",
    );
    setDialogOpen(false);
    resetForm();
    router.push(
      brandHubHref(`/brand-hub/review-intelligence/${result.id}`, brandId),
    );
  }

  async function handleCreateCsv() {
    let result;
    try {
      result = await new Promise<{ id: string }>((resolve, reject) => {
        startTransition(async () => {
          try {
            resolve(await createBrandReviewIntelSourceFromCsv({
              productName,
              competitorBrand,
              csvContent,
              productUrl:
                productUrl.trim() || "https://manual-import.local/reviews",
            }));
          } catch (err) {
            reject(err);
          }
        });
      });
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal import CSV."));
      return;
    }
    toast.success("Review diimport dan dianalisis.");
    setDialogOpen(false);
    resetForm();
    router.push(
      brandHubHref(`/brand-hub/review-intelligence/${result.id}`, brandId),
    );
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <BrandHubStatChip
            label="Sumber"
            value={sources.length.toLocaleString("id-ID")}
            tone="primary"
          />
          <BrandHubStatChip
            label="Siap"
            value={readyCount.toLocaleString("id-ID")}
            tone="success"
          />
          <BrandHubStatChip
            label="Total review"
            value={totalReviews.toLocaleString("id-ID")}
          />
          {partialCount > 0 ? (
            <BrandHubStatChip
              label="Parsial"
              value={partialCount.toLocaleString("id-ID")}
              tone="warning"
            />
          ) : null}
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 size-3.5" aria-hidden />
                Tambah Produk
              </Button>
            }
          />
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Tambah Sumber Review</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "scrape" ? "default" : "outline"}
                  onClick={() => setMode("scrape")}
                >
                  Scrape URL
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "csv" ? "default" : "outline"}
                  onClick={() => {
                    setMode("csv");
                    setPlatformKey("csv");
                  }}
                >
                  <FileUp className="size-3.5" aria-hidden />
                  Import CSV
                </Button>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="productName">Nama produk</Label>
                <Input
                  id="productName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Body Lotion Brightening 200ml"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="competitorBrand">Brand kompetitor</Label>
                <Input
                  id="competitorBrand"
                  value={competitorBrand}
                  onChange={(e) => setCompetitorBrand(e.target.value)}
                  placeholder="Brand X"
                />
              </div>

              {mode === "scrape" ? (
                <>
                  <div className="grid gap-1.5">
                    <Label>Sumber review</Label>
                    <Select
                      value={platformKey}
                      items={PLATFORM_ITEMS}
                      onValueChange={(v) => {
                        if (v) setPlatformKey(v);
                      }}
                    >
                      <SelectTrigger>
                        {selectedPlatform?.label ?? platformKey}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Marketplace</SelectLabel>
                          {reviewPlatformsByCategory("marketplace").map((p) => (
                            <SelectItem key={p.key} value={p.key}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Komunitas</SelectLabel>
                          {reviewPlatformsByCategory("community").map((p) => (
                            <SelectItem key={p.key} value={p.key}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="productUrl">URL produk</Label>
                    <Input
                      id="productUrl"
                      value={productUrl}
                      onChange={(e) => setProductUrl(e.target.value)}
                      placeholder={
                        selectedPlatform?.urlPlaceholder ?? "https://..."
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="csvFile">File CSV</Label>
                    <Input
                      id="csvFile"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) =>
                        handleCsvFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <p className="text-muted-foreground text-xs">
                      Kolom wajib: text/review/ulasan. Opsional: rating, author,
                      date.
                    </p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="csvPaste">Atau tempel CSV</Label>
                    <Textarea
                      id="csvPaste"
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                      rows={5}
                      placeholder={'text,rating,author\n"Tekstur enak",5,Sari'}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="csvRefUrl">URL referensi (opsional)</Label>
                    <Input
                      id="csvRefUrl"
                      value={productUrl}
                      onChange={(e) => setProductUrl(e.target.value)}
                      placeholder="https://reviews.femaledaily.com/products/..."
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={mode === "csv" ? handleCreateCsv : handleCreateScrape}
                disabled={
                  pending ||
                  !productName.trim() ||
                  !competitorBrand.trim() ||
                  (mode === "scrape"
                    ? !productUrl.trim()
                    : !csvContent.trim())
                }
              >
                {pending
                  ? "Memproses…"
                  : mode === "csv"
                    ? "Import & Analisis"
                    : "Mulai Scrape & Analisis"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {hasInProgress ? (
        <div className={hub.entrance}>
          <JobProgressBar
            title="Scrape & analisis review berjalan"
            percent={40}
            stepLabel="Satu atau lebih sumber sedang mengambil review dan menjalankan AI."
          />
          <p className="text-muted-foreground mt-1.5 px-1 text-xs">
            Halaman diperbarui otomatis setiap beberapa detik.
          </p>
        </div>
      ) : null}

      <BrandHubSection
        title="Sumber Review"
        description="Produk kompetitor yang sudah atau sedang dianalisis."
      >
        {sources.length === 0 ? (
          <BrandHubEmptyState
            icon={Star}
            title="Belum ada sumber review"
            description="Tambahkan URL produk kompetitor atau import CSV untuk mulai analisis sentimen, keluhan, dan gap opportunity."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Tambah Produk
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sources.map((s, index) => (
              <div
                key={s.id}
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
                      href={brandHubHref(
                        `/brand-hub/review-intelligence/${s.id}`,
                        brandId,
                      )}
                      className="hover:text-primary line-clamp-2 text-base font-semibold transition-colors duration-150 motion-reduce:transition-none"
                    >
                      {s.productName}
                    </Link>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {s.competitorBrand} · {getReviewPlatformLabel(s.platformKey)}
                    </p>
                  </div>
                  <BrandHubStatChip
                    label="Status"
                    value={SOURCE_STATUS_LABELS[s.status]}
                    tone={statusChipTone(s.status)}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <BrandHubStatChip
                    label="Review"
                    value={s.reviewCount.toLocaleString("id-ID")}
                    tone="primary"
                  />
                  {isPartial(s) ? (
                    <BrandHubStatChip
                      label="Dari total"
                      value={s.totalReviewsReported!.toLocaleString("id-ID")}
                      tone="warning"
                    />
                  ) : null}
                  <BrandHubStatChip
                    label="Update"
                    value={formatRelativeTime(
                      s.lastAnalyzedAt ? new Date(s.lastAnalyzedAt) : null,
                    )}
                  />
                </div>

                {s.errorMessage ? (
                  <p className="text-rose-700 dark:text-rose-300 mt-2 text-xs">
                    {s.errorMessage}
                  </p>
                ) : null}

                {isPartial(s) ? (
                  <p className="text-amber-700 dark:text-amber-300 mt-2 text-xs">
                    Data parsial — scraper mengambil{" "}
                    {Math.round(
                      (s.reviewCount / s.totalReviewsReported!) * 100,
                    )}
                    % dari total yang dilaporkan marketplace.
                  </p>
                ) : null}

                <div className="mt-3 flex gap-1 border-t border-border/40 pt-3">
                  {s.platformKey !== "csv" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending || isInProgress(s.status)}
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await rescrapeBrandReviewIntelSource(s.id);
                            toast.success("Scrape ulang dimulai.");
                            router.refresh();
                          } catch (err) {
                            toast.error(
                              actionErrorMessage(
                                err,
                                "Gagal memproses permintaan.",
                              ),
                            );
                          }
                        })
                      }
                    >
                      <RefreshCw className="size-3.5" aria-hidden />
                      Refresh
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        if (!confirm("Hapus sumber ini?")) return;
                        try {
                          await deleteBrandReviewIntelSource(s.id);
                          toast.success("Sumber dihapus.");
                          router.refresh();
                        } catch (err) {
                          toast.error(
                            actionErrorMessage(
                              err,
                              "Gagal memproses permintaan.",
                            ),
                          );
                        }
                      })
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </BrandHubSection>
    </div>
  );
}
