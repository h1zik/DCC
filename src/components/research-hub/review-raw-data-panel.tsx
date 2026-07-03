"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { actionErrorMessage } from "@/lib/action-error-message";
import type {
  ReviewRawPage,
  ReviewSentimentFilter,
} from "@/lib/review-scrape/review-raw-types";
import { cn } from "@/lib/utils";

type FetchPageFn = (input: {
  sourceId: string;
  page: number;
  search?: string;
  sentiment?: ReviewSentimentFilter;
}) => Promise<ReviewRawPage>;

type ExportCsvFn = (
  sourceId: string,
  search?: string,
  sentiment?: ReviewSentimentFilter,
) => Promise<string>;

type SentimentFilterValue = "ALL" | ReviewSentimentFilter;

const SENTIMENT_LABELS: Record<string, string> = {
  POSITIVE: "Positif",
  NEUTRAL: "Netral",
  NEGATIVE: "Negatif",
};

const SENTIMENT_FILTERS: {
  value: SentimentFilterValue;
  label: string;
}[] = [
  { value: "ALL", label: "Semua" },
  { value: "POSITIVE", label: "Positif" },
  { value: "NEUTRAL", label: "Netral" },
  { value: "NEGATIVE", label: "Negatif" },
];

function formatReviewDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sentimentChipClass(value: SentimentFilterValue, active: boolean): string {
  if (!active) return "text-muted-foreground hover:bg-muted/60 hover:text-foreground";
  switch (value) {
    case "POSITIVE":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25";
    case "NEUTRAL":
      return "bg-muted text-foreground ring-1 ring-border/60";
    case "NEGATIVE":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/25";
    default:
      return "bg-primary/10 text-primary ring-1 ring-primary/20";
  }
}

export function ReviewRawDataPanel({
  sourceId,
  productName,
  productUrl,
  reviewCount,
  fetchPage,
  exportCsv,
  bare = false,
}: {
  sourceId: string;
  productName: string;
  /** URL produk sumber — verifikasi review langsung di marketplace. */
  productUrl?: string | null;
  reviewCount: number;
  fetchPage: FetchPageFn;
  exportCsv: ExportCsvFn;
  bare?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilterValue>("ALL");
  const [data, setData] = useState<ReviewRawPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const activeSentiment: ReviewSentimentFilter | undefined =
    sentimentFilter === "ALL" ? undefined : sentimentFilter;

  const hasFilter = Boolean(search) || sentimentFilter !== "ALL";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPage({
        sourceId,
        page,
        search: search || undefined,
        sentiment: activeSentiment,
      });
      setData(result);
      if (result.page !== page) setPage(result.page);
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal memuat raw review."));
    } finally {
      setLoading(false);
    }
  }, [fetchPage, sourceId, page, search, activeSentiment]);

  useEffect(() => {
    if (reviewCount <= 0) return;
    void load();
  }, [load, reviewCount]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  function handleSentimentChange(next: SentimentFilterValue) {
    setSentimentFilter(next);
    setPage(1);
  }

  if (reviewCount <= 0) {
    const empty = (
      <p className="text-muted-foreground text-sm">
        Belum ada review ter-scrape. Jalankan scrape terlebih dahulu.
      </p>
    );
    if (bare) return empty;
    return (
      <div className={hub.panel}>
        <p className="mb-2 text-sm font-semibold">Raw Reviews</p>
        {empty}
      </div>
    );
  }

  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? reviewCount;

  const content = (
    <>
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!bare ? (
            <div>
              <p className="text-sm font-semibold">Raw Reviews</p>
              <p className="text-muted-foreground text-xs">
                {total.toLocaleString("id-ID")} review
                {hasFilter ? " (hasil filter)" : ""} · data mentah hasil scrape
                {productUrl && /^https?:\/\//.test(productUrl) ? (
                  <>
                    {" · "}
                    <a
                      href={productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-0.5 hover:underline"
                    >
                      verifikasi di sumber
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              {total.toLocaleString("id-ID")} review
              {hasFilter ? " (hasil filter)" : ""}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:w-56 sm:flex-none">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari author atau teks…"
                className="h-8 pl-8 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || loading}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const csv = await exportCsv(
                      sourceId,
                      search || undefined,
                      activeSentiment,
                    );
                    const slug = productName
                      .replace(/[^\w\s-]/g, "")
                      .trim()
                      .replace(/\s+/g, "-")
                      .slice(0, 40);
                    downloadCsv(`reviews-${slug || sourceId}.csv`, csv);
                    toast.success("CSV berhasil diunduh.");
                  } catch (err) {
                    toast.error(actionErrorMessage(err, "Gagal export CSV."));
                  }
                })
              }
            >
              <Download className="size-3.5" aria-hidden />
              Export CSV
            </Button>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter sentimen"
        >
          <span className="text-muted-foreground mr-1 text-[11px] font-medium uppercase tracking-wide">
            Sentimen
          </span>
          {SENTIMENT_FILTERS.map((f) => {
            const active = sentimentFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => handleSentimentChange(f.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none",
                  sentimentChipClass(f.value, active),
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <Table
        fitViewport
        containerStyle={{ maxHeight: "28rem" }}
        containerClassName="rounded-xl border border-border/40"
      >
        <TableHeader sticky>
          <TableRow>
            <TableHead className="w-[100px]">Tanggal</TableHead>
            <TableHead className="w-[120px]">Author</TableHead>
            <TableHead className="w-[56px] text-center">Rating</TableHead>
            <TableHead className="w-[80px]">Sentimen</TableHead>
            <TableHead>Review</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && !data ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                Memuat review…
              </TableCell>
            </TableRow>
          ) : data && data.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                Tidak ada review cocok dengan filter.
              </TableCell>
            </TableRow>
          ) : (
            data?.rows.map((row) => (
              <TableRow
                key={row.id}
                className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
              >
                <TableCell className="text-muted-foreground text-xs tabular-nums">
                  {formatReviewDate(row.reviewDate)}
                </TableCell>
                <TableCell className="text-xs font-medium">
                  {row.author ?? "—"}
                </TableCell>
                <TableCell className="text-center text-xs tabular-nums">
                  {row.rating != null ? row.rating : "—"}
                </TableCell>
                <TableCell>
                  {row.sentiment ? (
                    <span
                      className={cn(
                        "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        row.sentiment === "POSITIVE" &&
                          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                        row.sentiment === "NEUTRAL" &&
                          "bg-muted text-muted-foreground",
                        row.sentiment === "NEGATIVE" &&
                          "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                      )}
                    >
                      {SENTIMENT_LABELS[row.sentiment] ?? row.sentiment}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm leading-relaxed whitespace-pre-wrap">
                  {row.text}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Halaman {page} dari {totalPages}
          {loading ? " · memuat…" : null}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Sebelumnya
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </>
  );

  if (bare) {
    return <div className={hub.panel}>{content}</div>;
  }

  return <div className={hub.panel}>{content}</div>;
}
