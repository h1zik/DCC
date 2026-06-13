"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ResearchMarketplace, ReviewIntelSourceStatus } from "@prisma/client";
import { Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createReviewIntelSource,
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
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MARKETPLACE_LABELS,
  SOURCE_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import { cn } from "@/lib/utils";
import { useReviewIntelPolling } from "./use-review-intel-polling";

export type ReviewSourceRow = {
  id: string;
  productName: string;
  competitorBrand: string;
  marketplace: ResearchMarketplace;
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

export function ReviewIntelligenceClient({
  sources,
}: {
  sources: ReviewSourceRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [competitorBrand, setCompetitorBrand] = useState("");
  const [marketplace, setMarketplace] = useState<ResearchMarketplace>(
    ResearchMarketplace.SHOPEE,
  );
  const [productUrl, setProductUrl] = useState("");

  const hasInProgress = sources.some(
    (s) => s.status === "SCRAPING" || s.status === "ANALYZING",
  );

  useReviewIntelPolling(hasInProgress);

  function handleCreate() {
    startTransition(async () => {
      try {
        const result = await createReviewIntelSource({
          productName,
          competitorBrand,
          marketplace,
          productUrl,
        });
        toast.success(
          "Scrape dimulai di background. Halaman akan update otomatis.",
        );
        setDialogOpen(false);
        setProductName("");
        setCompetitorBrand("");
        setProductUrl("");
        router.push(`/research-hub/review-intelligence/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {sources.length} sumber produk dianalisis
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="size-3.5" aria-hidden />
                Tambah Produk
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Scraper</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
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
              <div className="grid gap-1.5">
                <Label>Marketplace</Label>
                <Select
                  value={marketplace}
                  onValueChange={(v) => {
                    if (v) setMarketplace(v as ResearchMarketplace);
                  }}
                >
                  <SelectTrigger>
                    {MARKETPLACE_LABELS[marketplace]}
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MARKETPLACE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="productUrl">URL produk</Label>
                <Input
                  id="productUrl"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://shopee.co.id/..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={
                  pending ||
                  !productName.trim() ||
                  !competitorBrand.trim() ||
                  !productUrl.trim()
                }
              >
                {pending ? "Menambahkan…" : "Mulai Scrape & Analisis"}
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
            Tambahkan URL produk kompetitor untuk mulai analisis sentimen.
          </p>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Marketplace</TableHead>
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
                  <TableCell className="text-sm">
                    {MARKETPLACE_LABELS[s.marketplace]}
                  </TableCell>
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
                        title={`Marketplace melaporkan ${s.totalReviewsReported.toLocaleString("id-ID")} review, namun hanya ${s.reviewCount.toLocaleString("id-ID")} yang bisa diambil scraper.`}
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
                              toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
                            }
                          })
                        }
                        title="Scrape ulang"
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
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
                              toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
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
