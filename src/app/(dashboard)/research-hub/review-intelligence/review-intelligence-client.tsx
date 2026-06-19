"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ResearchMarketplace, ReviewIntelSourceStatus } from "@prisma/client";
import { FileUp, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createReviewIntelSource,
  createReviewIntelSourceFromCsv,
  deleteReviewIntelSource,
  rescrapeReviewIntelSource,
} from "@/actions/research-review-intelligence";
import { actionErrorMessage } from "@/lib/action-error-message";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getReviewPlatformLabel,
  REVIEW_PLATFORMS,
  reviewPlatformsByCategory,
} from "@/lib/review-platforms/platforms";
import { SOURCE_STATUS_LABELS, formatRelativeTime } from "@/lib/research/labels";
import { cn } from "@/lib/utils";
import { useReviewIntelPolling } from "./use-review-intel-polling";

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

function statusTone(status: ReviewIntelSourceStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "SCRAPING":
    case "ANALYZING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function platformLabel(row: ReviewSourceRow): string {
  return getReviewPlatformLabel(row.platformKey);
}

export function ReviewIntelligenceClient({
  sources,
}: {
  sources: ReviewSourceRow[];
}) {
  const router = useRouter();
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

  const hasInProgress = sources.some(
    (s) => s.status === "SCRAPING" || s.status === "ANALYZING",
  );

  useReviewIntelPolling(hasInProgress);

  function resetForm() {
    setProductName("");
    setCompetitorBrand("");
    setProductUrl("");
    setCsvContent("");
    setPlatformKey("shopee");
    setMode("scrape");
  }

  function handleCreateScrape() {
    startTransition(async () => {
      try {
        const result = await createReviewIntelSource({
          productName,
          competitorBrand,
          platformKey,
          productUrl,
        });
        toast.success(
          "Scrape dimulai di background. Halaman akan update otomatis.",
        );
        setDialogOpen(false);
        resetForm();
        router.push(`/research-hub/review-intelligence/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  function handleCreateCsv() {
    startTransition(async () => {
      try {
        const result = await createReviewIntelSourceFromCsv({
          productName,
          competitorBrand,
          csvContent,
          productUrl: productUrl.trim() || "https://manual-import.local/reviews",
        });
        toast.success("Review diimport dan dianalisis.");
        setDialogOpen(false);
        resetForm();
        router.push(`/research-hub/review-intelligence/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal import CSV."));
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {sources.length} sumber produk dianalisis
        </p>
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
                <Plus className="size-3.5" aria-hidden />
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
                        selectedPlatform?.urlPlaceholder ??
                        "https://..."
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
                      placeholder={"text,rating,author\n\"Tekstur enak\",5,Sari"}
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

      {sources.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center">
          <Star className="mx-auto mb-3 size-8 opacity-40" aria-hidden />
          <p className="text-sm font-medium">Belum ada sumber review</p>
          <p className="mt-1 text-xs">
            Tambahkan URL produk kompetitor atau import CSV untuk mulai analisis
            sentimen.
          </p>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Review</TableHead>
                <TableHead>Update</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/research-hub/review-intelligence/${s.id}`}
                      className="hover:text-primary font-medium"
                    >
                      {s.productName}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {s.competitorBrand}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">{platformLabel(s)}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        statusTone(s.status),
                      )}
                    >
                      {SOURCE_STATUS_LABELS[s.status]}
                    </span>
                    {s.errorMessage ? (
                      <p className="text-destructive mt-1 max-w-xs truncate text-[10px]">
                        {s.errorMessage}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="tabular-nums">
                      {s.reviewCount.toLocaleString("id-ID")}
                    </span>
                    {s.totalReviewsReported != null &&
                    s.totalReviewsReported > s.reviewCount ? (
                      <p
                        className="text-amber-600 dark:text-amber-400 text-[10px] font-medium"
                        title={`Sumber melaporkan ${s.totalReviewsReported.toLocaleString("id-ID")} review, namun hanya ${s.reviewCount.toLocaleString("id-ID")} yang bisa diambil scraper.`}
                      >
                        dari {s.totalReviewsReported.toLocaleString("id-ID")} ·
                        parsial
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatRelativeTime(
                      s.lastAnalyzedAt ? new Date(s.lastAnalyzedAt) : null,
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {s.platformKey !== "csv" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending}
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
                          title="Scrape ulang"
                        >
                          <RefreshCw className="size-3.5" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={pending}
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
                        title="Hapus"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
