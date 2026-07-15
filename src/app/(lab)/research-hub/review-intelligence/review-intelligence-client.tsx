"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ResearchMarketplace, ReviewIntelSourceStatus } from "@prisma/client";
import {
  ArrowUpRight,
  FileUp,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createReviewIntelSource,
  createReviewIntelSourceFromCsv,
  deleteReviewIntelSource,
  rescrapeReviewIntelSource,
} from "@/actions/research-review-intelligence";
import { actionErrorMessage } from "@/lib/action-error-message";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
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
  getReviewPlatformLabel,
  REVIEW_PLATFORMS,
  reviewPlatformsByCategory,
} from "@/lib/review-platforms/platforms";
import { SOURCE_STATUS_LABELS } from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { RelativeTime } from "@/components/research-hub/relative-time";
import { lab, LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";
import { useReviewIntelPolling } from "./use-review-intel-polling";

const PLATFORM_ITEMS: SelectItemDef[] = [
  ...reviewPlatformsByCategory("marketplace"),
  ...reviewPlatformsByCategory("community"),
].map((p) => ({ value: p.key, label: p.label }));

export type ReviewSourceRow = {
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

function isInProgress(status: ReviewIntelSourceStatus) {
  return status === "SCRAPING" || status === "ANALYZING";
}

function isPartial(row: ReviewSourceRow) {
  return (
    row.totalReviewsReported != null &&
    row.totalReviewsReported > row.reviewCount
  );
}

/** Pill status tinted: emerald siap, amber berjalan, rose gagal, muted menunggu. */
function StatusPill({ status }: { status: ReviewIntelSourceStatus }) {
  const running = isInProgress(status);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        status === "READY" &&
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        status === "FAILED" &&
          "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        running && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        status === "PENDING" && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "READY" && "bg-emerald-500",
          status === "FAILED" && "bg-rose-500",
          running && "bg-amber-500 animate-pulse motion-reduce:animate-none",
          status === "PENDING" && "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      {SOURCE_STATUS_LABELS[status]}
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

export function ReviewIntelligenceClient({
  sources,
}: {
  sources: ReviewSourceRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(sources.length === 0);
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
  const inProgressCount = sources.filter((s) => isInProgress(s.status)).length;
  const readyCount = sources.filter((s) => s.status === "READY").length;
  const failedCount = sources.filter((s) => s.status === "FAILED").length;
  const totalReviews = sources.reduce((sum, s) => sum + s.reviewCount, 0);
  const partialCount = sources.filter(isPartial).length;

  useReviewIntelPolling(hasInProgress);

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
            resolve(await createReviewIntelSource({
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
    setFormOpen(false);
    resetForm();
    router.push(`/research-hub/review-intelligence/${result.id}`);
  }

  async function handleCreateCsv() {
    let result;
    try {
      result = await new Promise<{ id: string }>((resolve, reject) => {
        startTransition(async () => {
          try {
            resolve(await createReviewIntelSourceFromCsv({
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
    setFormOpen(false);
    resetForm();
    router.push(`/research-hub/review-intelligence/${result.id}`);
  }

  function handleCsvFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvContent(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  const submitDisabled =
    pending ||
    !productName.trim() ||
    !competitorBrand.trim() ||
    (mode === "scrape" ? !productUrl.trim() : !csvContent.trim());

  return (
    <div className="flex flex-col gap-6">
      {/* Strip ringkasan bento */}
      {sources.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Total review
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {totalReviews.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-violet-100/90 dark:text-violet-900/80">
              dari {sources.length} sumber kompetitor
              {partialCount > 0 ? ` · ${partialCount} parsial` : ""}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Siap dianalisis</span>
            <span className="bento-value">
              {readyCount}
              <span className="text-muted-foreground/60 text-lg font-bold">
                {" "}
                / {sources.length}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              sumber dengan insight lengkap
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Berjalan
            </span>
            <span className="bento-value text-amber-900 dark:text-amber-300">
              {inProgressCount}
            </span>
            <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-200/50">
              scrape / analisis aktif
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#fbdcd7] dark:bg-rose-400/10">
            <span className="text-[11.5px] font-semibold text-rose-800/70 dark:text-rose-200/60">
              Gagal
            </span>
            <span className="bento-value text-rose-900 dark:text-rose-300">
              {failedCount}
            </span>
            <span className="text-[11px] font-medium text-rose-800/60 dark:text-rose-200/50">
              perlu scrape ulang
            </span>
          </div>
        </div>
      ) : null}

      {hasInProgress ? (
        <div className={lab.entrance}>
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

      <LabSection
        title="Sumber Review"
        description={
          sources.length === 0
            ? "Mulai dengan menambahkan produk kompetitor pertama di bawah."
            : `${sources.length} produk kompetitor · ${totalReviews.toLocaleString("id-ID")} review terkumpul.`
        }
        action={
          sources.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Tambah Produk"}
            </Button>
          ) : null
        }
      >
        {/* Form tambah sumber (collapsible) */}
        {formOpen ? (
          <div
            className={cn(
              lab.panel,
              "grid gap-4",
              "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-foreground font-bold tracking-tight">
                  Tambah sumber review
                </p>
                <p className="text-muted-foreground text-sm">
                  Scrape URL produk kompetitor, atau import CSV review yang
                  sudah Anda miliki.
                </p>
              </div>
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
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="productName">Nama produk</Label>
                <Input
                  id="productName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Body Lotion Brightening 200ml"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="competitorBrand">Brand kompetitor</Label>
                <Input
                  id="competitorBrand"
                  value={competitorBrand}
                  onChange={(e) => setCompetitorBrand(e.target.value)}
                  placeholder="Brand X"
                  disabled={pending}
                />
              </div>
            </div>

            {mode === "scrape" ? (
              <div className="grid gap-3 sm:grid-cols-2">
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
                    disabled={pending}
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="csvFile">File CSV</Label>
                  <Input
                    id="csvFile"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
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
                    disabled={pending}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="csvRefUrl">URL referensi (opsional)</Label>
                  <Input
                    id="csvRefUrl"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://reviews.femaledaily.com/products/..."
                    disabled={pending}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                {mode === "scrape"
                  ? "Review di-scrape lalu dianalisis AI — sentimen, keluhan, pujian, dan gap opportunity."
                  : "Review dari CSV langsung dianalisis tanpa scraping."}
              </p>
              <Button
                onClick={mode === "csv" ? handleCreateCsv : handleCreateScrape}
                disabled={submitDisabled}
              >
                <Plus />
                {pending
                  ? "Memproses…"
                  : mode === "csv"
                    ? "Import & Analisis"
                    : "Mulai Scrape & Analisis"}
              </Button>
            </div>
          </div>
        ) : null}

        {sources.length === 0 ? (
          !formOpen ? (
            <LabEmptyState
              icon={Star}
              title="Belum ada sumber review"
              description="Tambahkan URL produk kompetitor atau import CSV untuk mulai analisis sentimen, keluhan, dan gap opportunity."
              action={
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  Tambah Produk
                </Button>
              }
            />
          ) : null
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sources.map((s) => {
              const coverage = isPartial(s)
                ? Math.round((s.reviewCount / s.totalReviewsReported!) * 100)
                : null;
              return (
                <div
                  key={s.id}
                  className={cn(lab.card, "group flex flex-col p-0")}
                >
                  <Link
                    href={`/research-hub/review-intelligence/${s.id}`}
                    className="flex flex-1 flex-col gap-4 p-5 pb-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold uppercase"
                          aria-hidden
                        >
                          {s.productName.trim().charAt(0) || "?"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                            <span className="truncate">{s.productName}</span>
                            <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {s.competitorBrand} ·{" "}
                            {getReviewPlatformLabel(s.platformKey)}
                          </p>
                        </div>
                      </div>
                      <StatusPill status={s.status} />
                    </div>

                    {s.status === "FAILED" && s.errorMessage ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-rose-700 dark:text-rose-300">
                        {s.errorMessage}
                      </p>
                    ) : null}

                    <div className="grid grid-cols-3 gap-2">
                      <CardStat
                        label="Review"
                        value={s.reviewCount.toLocaleString("id-ID")}
                      />
                      <CardStat
                        label="Cakupan"
                        value={
                          coverage != null
                            ? `${coverage}%`
                            : s.reviewCount > 0
                              ? "Penuh"
                              : "—"
                        }
                      />
                      <CardStat
                        label="Update"
                        value={
                          <RelativeTime
                            date={
                              s.lastAnalyzedAt
                                ? new Date(s.lastAnalyzedAt)
                                : null
                            }
                          />
                        }
                      />
                    </div>
                  </Link>

                  <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5 truncate text-xs">
                      <Star className="size-3.5 shrink-0" aria-hidden />
                      {getReviewPlatformLabel(s.platformKey)}
                    </span>
                    <div className="flex items-center gap-1">
                      {s.platformKey !== "csv" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending || isInProgress(s.status)}
                          onClick={() =>
                            startTransition(async () => {
                              try {
                                await rescrapeReviewIntelSource(s.id);
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
                        aria-label="Hapus sumber"
                        onClick={() =>
                          startTransition(async () => {
                            if (!confirm("Hapus sumber ini?")) return;
                            try {
                              await deleteReviewIntelSource(s.id);
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
                </div>
              );
            })}
          </div>
        )}
      </LabSection>
    </div>
  );
}
