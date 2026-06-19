"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { toast } from "sonner";
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
import type { ReviewRawPage } from "@/lib/review-scrape/review-raw-types";
import { cn } from "@/lib/utils";

type FetchPageFn = (input: {
  sourceId: string;
  page: number;
  search?: string;
}) => Promise<ReviewRawPage>;

type ExportCsvFn = (sourceId: string, search?: string) => Promise<string>;

const SENTIMENT_LABELS: Record<string, string> = {
  POSITIVE: "Positif",
  NEUTRAL: "Netral",
  NEGATIVE: "Negatif",
};

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

export function ReviewRawDataPanel({
  sourceId,
  productName,
  reviewCount,
  fetchPage,
  exportCsv,
}: {
  sourceId: string;
  productName: string;
  reviewCount: number;
  fetchPage: FetchPageFn;
  exportCsv: ExportCsvFn;
}) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ReviewRawPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPage({ sourceId, page, search: search || undefined });
      setData(result);
      if (result.page !== page) setPage(result.page);
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal memuat raw review."));
    } finally {
      setLoading(false);
    }
  }, [fetchPage, sourceId, page, search]);

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

  if (reviewCount <= 0) {
    return (
      <section className="border-border bg-card rounded-xl border p-4 shadow-sm">
        <h2 className="text-foreground mb-2 text-sm font-semibold">Raw Reviews</h2>
        <p className="text-muted-foreground text-sm">
          Belum ada review ter-scrape. Jalankan scrape terlebih dahulu.
        </p>
      </section>
    );
  }

  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? reviewCount;

  return (
    <section className="border-border bg-card rounded-xl border p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground text-sm font-semibold">Raw Reviews</h2>
          <p className="text-muted-foreground text-xs">
            {total.toLocaleString("id-ID")} review
            {search ? " (hasil filter)" : ""} · data mentah hasil scrape
          </p>
        </div>
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
                  const csv = await exportCsv(sourceId, search || undefined);
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

      <Table
        fitViewport
        containerStyle={{ maxHeight: "28rem" }}
        containerClassName="rounded-lg border"
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
              <TableRow key={row.id}>
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
                          "bg-emerald-500/15 text-emerald-700",
                        row.sentiment === "NEUTRAL" &&
                          "bg-muted text-muted-foreground",
                        row.sentiment === "NEGATIVE" &&
                          "bg-rose-500/15 text-rose-700",
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
    </section>
  );
}
