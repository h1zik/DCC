"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  markAllCompetitorAlertsRead,
  markCompetitorAlertRead,
  refreshResearchCompetitor,
} from "@/actions/research-competitor";
import { actionErrorMessage } from "@/lib/action-error-message";
import type { CompetitorInsights } from "@/lib/research/competitor-insights";
import { formatRp } from "@/lib/research/labels";
import { CompetitorInsightsPanel } from "@/components/research-hub/competitor-insights-panel";
import {
  CompetitorPriceBarChart,
  type PriceBarPoint,
} from "@/components/research-hub/competitor-price-bar-chart";
import { CompetitorPriceChart } from "@/components/research-hub/competitor-price-chart";
import { ShareOfReviewChart } from "@/components/research-hub/share-of-review-chart";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

type Sku = {
  id: string;
  name: string;
  productUrl: string;
  currentPrice: number | null;
  rating: number | null;
  reviewCount: number;
  isNew: boolean;
  hasPromo: boolean;
  promoText: string | null;
  priceDeltaPct: number | null;
  priceDirection: "up" | "down" | null;
};

type PriceChartBundle = {
  data: Record<string, string | number | null>[];
  skuNames: string[];
  hasTrend: boolean;
};

type Alert = {
  id: string;
  type: string;
  message: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
};

export type CompetitorDetail = {
  id: string;
  name: string;
  brand: string;
  category: string;
  marketplace: keyof typeof MARKETPLACE_LABELS;
  shopUrl: string;
  skus: Sku[];
  insights: CompetitorInsights;
  currentPriceBar: PriceBarPoint[];
  alerts: Alert[];
  priceChart30: PriceChartBundle;
  priceChart60: PriceChartBundle;
  priceChart90: PriceChartBundle;
  shareOfReview: { name: string; value: number }[];
};

export function CompetitorDetailClient({
  competitor,
}: {
  competitor: CompetitorDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [priceDays, setPriceDays] = useState<30 | 60 | 90>(30);

  const priceChart =
    priceDays === 30
      ? competitor.priceChart30
      : priceDays === 60
        ? competitor.priceChart60
        : competitor.priceChart90;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href="/research-hub/competitor-tracker">
              <ArrowLeft className="size-3.5" aria-hidden />
              Kembali
            </Link>
          }
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await refreshResearchCompetitor(competitor.id);
                toast.success("Data kompetitor diperbarui.");
                router.refresh();
              } catch (err) {
                toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
              }
            })
          }
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Refresh Sekarang
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <a href={competitor.shopUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" aria-hidden />
              Buka Toko
            </a>
          }
        />
      </div>

      <header className="border-border bg-card rounded-2xl border p-5 shadow-sm">
        <h1 className="text-foreground text-2xl font-semibold">{competitor.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {competitor.brand} · {competitor.category} ·{" "}
          {MARKETPLACE_LABELS[competitor.marketplace]}
        </p>
      </header>

      <CompetitorInsightsPanel insights={competitor.insights} />

      <section className="border-border bg-card rounded-xl border p-4 shadow-sm">
        <h2 className="text-foreground mb-3 text-sm font-semibold">SKU Tracker</h2>
        {competitor.skus.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Belum ada SKU — refresh atau tunggu scrape selesai.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Review</TableHead>
                <TableHead>Promo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitor.skus.map((sku) => (
                <TableRow key={sku.id}>
                  <TableCell>
                    <a
                      href={sku.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary font-medium"
                    >
                      {sku.name}
                    </a>
                    {sku.isNew ? (
                      <span className="bg-primary/15 text-primary ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        Baru
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span>
                      {sku.currentPrice != null
                        ? formatRp(sku.currentPrice)
                        : "—"}
                    </span>
                    {sku.priceDeltaPct != null && sku.priceDirection ? (
                      <span
                        className={cn(
                          "mt-0.5 block text-[10px] font-medium",
                          sku.priceDirection === "up"
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {sku.priceDirection === "up" ? "▲" : "▼"}{" "}
                        {sku.priceDeltaPct}%
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sku.rating?.toFixed(1) ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sku.reviewCount.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell>
                    {sku.hasPromo ? (
                      <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        {sku.promoText ?? "Promo"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="border-border bg-card rounded-xl border p-4 shadow-sm">
        <h2 className="text-foreground mb-1 text-sm font-semibold">
          Harga Saat Ini (Top SKU)
        </h2>
        <p className="text-muted-foreground mb-3 text-xs">
          Perbandingan harga hero SKU berdasarkan snapshot terakhir — berguna
          meski belum ada riwayat multi-hari.
        </p>
        <CompetitorPriceBarChart data={competitor.currentPriceBar} />
      </section>

      <section className="border-border bg-card rounded-xl border p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-foreground text-sm font-semibold">
              Trend Harga
            </h2>
            <p className="text-muted-foreground text-xs">
              Pergerakan harga per hari (butuh refresh harian / cron).
            </p>
          </div>
          <Tabs
            value={String(priceDays)}
            onValueChange={(v) => setPriceDays(Number(v) as 30 | 60 | 90)}
          >
            <TabsList>
              <TabsTrigger value="30">30 hari</TabsTrigger>
              <TabsTrigger value="60">60 hari</TabsTrigger>
              <TabsTrigger value="90">90 hari</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <CompetitorPriceChart
          data={priceChart.data}
          skuNames={priceChart.skuNames}
          hasTrend={priceChart.hasTrend}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border-border bg-card rounded-xl border p-4 shadow-sm">
          <h2 className="text-foreground mb-3 text-sm font-semibold">
            Share of Review
          </h2>
          <ShareOfReviewChart data={competitor.shareOfReview} />
        </section>

        <section className="border-border bg-card rounded-xl border p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-foreground text-sm font-semibold">Alert Feed</h2>
            {competitor.alerts.some((a) => !a.isRead) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await markAllCompetitorAlertsRead(competitor.id);
                      router.refresh();
                    } catch (err) {
                      toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
                    }
                  })
                }
              >
                Tandai semua dibaca
              </Button>
            ) : null}
          </div>
          {competitor.alerts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Tidak ada alert.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {competitor.alerts.map((alert) => (
                <li
                  key={alert.id}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    alert.isRead
                      ? "border-border/60 opacity-60"
                      : "border-primary/20 bg-primary/5",
                  )}
                >
                  <p>{alert.message}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(alert.createdAt).toLocaleString("id-ID")}
                    </span>
                    {!alert.isRead ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            try {
                              await markCompetitorAlertRead(alert.id);
                              router.refresh();
                            } catch (err) {
                              toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
                            }
                          })
                        }
                      >
                        Dibaca
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
