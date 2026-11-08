"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ResearchMarketplace, ReviewIntelSourceStatus } from "@prisma/client";
import { Plus, RefreshCw, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  deleteReviewIntelSource,
  rescrapeReviewIntelSource,
} from "@/actions/research-review-intelligence";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { getReviewPlatformLabel } from "@/lib/review-platforms/platforms";
import { SOURCE_STATUS_LABELS } from "@/lib/research/labels";
import { RelativeTime } from "@/components/research-hub/relative-time";
import {
  MarketplaceLogo,
  resolveMarketplace,
} from "@/components/research-hub/marketplace-logo";
import { LabEmptyState } from "@/components/lab/lab-primitives";
import { RunLedger, countRunTones } from "@/components/research-hub/kit/run-ledger";
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import {
  ResearchFilterBar,
  filterRuns,
  type RunToneFilter,
} from "@/components/research-hub/kit/research-filter-bar";
import {
  ResearchTable,
  SortableHead,
  useSortedRows,
} from "@/components/research-hub/kit/research-table";
import { useReviewIntelPolling } from "./use-review-intel-polling";
import { ReviewSourceForm } from "./review-source-form";

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

function toneOf(status: ReviewIntelSourceStatus): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (isInProgress(status)) return "running";
  return "idle";
}

/** Persentase review yang berhasil ditarik; null bila tidak diketahui/penuh. */
function coverageOf(row: ReviewSourceRow): number | null {
  if (row.totalReviewsReported == null || row.totalReviewsReported <= row.reviewCount) {
    return null;
  }
  return Math.round((row.reviewCount / row.totalReviewsReported) * 100);
}

const LEDGER_LABELS = { running: "Scrape atau analisis", idle: "Menunggu" } as const;

export function ReviewIntelligenceClient({
  sources,
}: {
  sources: ReviewSourceRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(sources.length === 0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<ReviewSourceRow | null>(null);

  const hasInProgress = sources.some((s) => isInProgress(s.status));
  const totalReviews = sources.reduce((sum, s) => sum + s.reviewCount, 0);
  const partialCount = sources.filter((s) => coverageOf(s) != null).length;
  const counts = useMemo(() => countRunTones(sources, (s) => toneOf(s.status)), [sources]);

  useReviewIntelPolling(hasInProgress);

  const filtered = useMemo(
    () =>
      filterRuns(sources, {
        search,
        status,
        text: (s) =>
          `${s.productName} ${s.competitorBrand} ${getReviewPlatformLabel(s.platformKey)}`,
        tone: (s) => toneOf(s.status),
      }),
    [sources, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    product: (s) => s.productName,
    brand: (s) => s.competitorBrand,
    reviews: (s) => s.reviewCount,
    updated: (s) => s.lastAnalyzedAt,
  });

  function handleRescrape(s: ReviewSourceRow) {
    startTransition(async () => {
      try {
        await rescrapeReviewIntelSource(s.id);
        toast.success(`"${s.productName}" di-scrape ulang.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal scrape ulang."));
      }
    });
  }

  function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteReviewIntelSource(target.id);
        toast.success(`"${target.productName}" dihapus.`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus sumber."));
      }
    });
  }

  const ledgerDetail =
    `${totalReviews.toLocaleString("id-ID")} review terkumpul` +
    (partialCount > 0 ? `, ${partialCount} sumber parsial` : "");

  return (
    <div className="flex flex-col gap-6">
      {sources.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
          <RunLedger
            className="flex-1"
            counts={counts}
            noun="sumber review"
            labels={LEDGER_LABELS}
            detail={ledgerDetail}
          />
          <Button
            variant={formOpen ? "outline" : "default"}
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            aria-controls="ri-form"
          >
            {formOpen ? <X aria-hidden /> : <Plus aria-hidden />}
            {formOpen ? "Tutup form" : "Tambah sumber"}
          </Button>
        </div>
      ) : null}

      {hasInProgress ? (
        <p className="rh-meta" aria-live="polite">
          Ada sumber yang masih di-scrape atau dianalisis. Halaman ini
          diperbarui otomatis setiap beberapa detik.
        </p>
      ) : null}

      {formOpen ? (
        <ReviewSourceForm
          id="ri-form"
          onCancel={sources.length > 0 ? () => setFormOpen(false) : undefined}
          onCreated={() => setFormOpen(false)}
        />
      ) : null}

      {sources.length === 0 && !formOpen ? (
        <LabEmptyState
          icon={Star}
          title="Belum ada sumber review"
          description="Tambahkan URL produk kompetitor atau impor CSV untuk mulai analisis sentimen, keluhan, dan gap opportunity."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Tambah sumber
            </Button>
          }
        />
      ) : null}

      {sources.length > 0 ? (
        <section aria-label="Daftar sumber review" className="flex flex-col gap-3">
          <ResearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari produk, brand, atau platform…"
            status={status}
            onStatusChange={setStatus}
            statusCounts={counts}
            statusLabels={LEDGER_LABELS}
            resultCount={filtered.length}
            totalCount={sources.length}
            onReset={() => {
              setSearch("");
              setStatus("all");
            }}
          />

          {sorted.length === 0 ? (
            <p className="rh-meta border-border rounded-xl border border-dashed px-5 py-8 text-center text-[13px]">
              Tidak ada sumber yang cocok dengan filter ini.
            </p>
          ) : (
            <ResearchTable maxHeight="70vh">
              <TableHeader sticky>
                <TableRow>
                  <SortableHead sortKey="product" sort={sort} onSort={toggle}>
                    Produk
                  </SortableHead>
                  <SortableHead sortKey="brand" sort={sort} onSort={toggle}>
                    Brand
                  </SortableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <SortableHead sortKey="reviews" sort={sort} onSort={toggle} align="right">
                    Review
                  </SortableHead>
                  <TableHead className="text-right">Cakupan</TableHead>
                  <SortableHead sortKey="updated" sort={sort} onSort={toggle}>
                    Dianalisis
                  </SortableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((s) => {
                  const tone = toneOf(s.status);
                  const coverage = coverageOf(s);
                  const platformLabel = getReviewPlatformLabel(s.platformKey);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-[22rem] whitespace-normal">
                        <Link
                          href={`/research-hub/review-intelligence/${s.id}`}
                          className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {s.productName}
                        </Link>
                        {tone === "failed" && s.errorMessage ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-rose-700 dark:text-rose-300">
                            {s.errorMessage}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.competitorBrand}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          {resolveMarketplace(s.platformKey) ? (
                            <MarketplaceLogo marketplace={s.platformKey} className="size-4" />
                          ) : (
                            <Star className="text-muted-foreground size-4 shrink-0" aria-hidden />
                          )}
                          {platformLabel}
                        </span>
                      </TableCell>
                      <TableCell>
                        <RunStatusBadge tone={tone} label={SOURCE_STATUS_LABELS[s.status]} />
                      </TableCell>
                      <TableCell className="rh-num text-right">
                        {s.reviewCount > 0 ? (
                          s.reviewCount.toLocaleString("id-ID")
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="rh-num text-right">
                        {coverage != null ? (
                          <span
                            className="text-amber-700 dark:text-amber-300"
                            title={`${s.reviewCount.toLocaleString("id-ID")} dari ${s.totalReviewsReported?.toLocaleString("id-ID")} review`}
                          >
                            {coverage}%
                          </span>
                        ) : s.reviewCount > 0 ? (
                          <span className="text-muted-foreground">Penuh</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <RelativeTime date={s.lastAnalyzedAt} className="text-[13px] font-normal" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          {s.platformKey !== "csv" ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              disabled={pending || isInProgress(s.status)}
                              onClick={() => handleRescrape(s)}
                              aria-label={`Scrape ulang "${s.productName}"`}
                              title="Scrape ulang"
                            >
                              <RefreshCw aria-hidden />
                            </Button>
                          ) : null}
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={pending}
                            onClick={() => setDeleteTarget(s)}
                            aria-label={`Hapus "${s.productName}"`}
                            title="Hapus sumber"
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </ResearchTable>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Hapus sumber "${deleteTarget?.productName ?? ""}"?`}
        description={`${(deleteTarget?.reviewCount ?? 0).toLocaleString("id-ID")} review beserta analisis sentimen, keluhan, dan gap opportunity-nya ikut terhapus. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus sumber"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
