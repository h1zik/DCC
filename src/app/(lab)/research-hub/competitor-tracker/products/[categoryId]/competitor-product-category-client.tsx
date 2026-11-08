"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ResearchMarketplace } from "@prisma/client";
import { Bell, ExternalLink, Package, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteCompetitorProductTrack,
  markAllCompetitorProductAlertsRead,
  markCompetitorProductAlertRead,
  refreshCompetitorProductCategory,
  refreshCompetitorProductTrack,
} from "@/actions/research-competitor-product";
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
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import { MarketplaceLogo } from "@/components/research-hub/marketplace-logo";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import { countRunTones } from "@/components/research-hub/kit/run-ledger";
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
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { MARKETPLACE_LABELS, formatRelativeTime, formatRp } from "@/lib/research/labels";
import { DetailSection, FactList, type Fact } from "../../_components/detail-section";
import { CompetitorAlertList } from "../../_components/competitor-alert-list";
import { AddProductDialog } from "./add-product-dialog";

export type CompetitorProductTrackRow = {
  id: string;
  name: string;
  brand: string | null;
  productUrl: string;
  marketplace: ResearchMarketplace;
  imageUrl: string | null;
  shopName: string | null;
  currentPrice: number | null;
  rating: number | null;
  reviewCount: number;
  hasPromo: boolean;
  promoText: string | null;
  scrapeError: string | null;
  lastScrapedAt: string | null;
};

export type CompetitorProductAlertRow = {
  id: string;
  type: string;
  message: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
};

export type CompetitorProductCategoryDetail = {
  id: string;
  name: string;
  description: string | null;
  tracks: CompetitorProductTrackRow[];
  alerts: CompetitorProductAlertRow[];
};

function toneOf(t: CompetitorProductTrackRow): RunTone {
  if (t.scrapeError) return "failed";
  return t.lastScrapedAt ? "ready" : "idle";
}

const STATUS_LABELS: Partial<Record<RunTone, string>> = {
  ready: "Terpantau",
  failed: "Gagal ditarik",
  idle: "Belum ditarik",
};

function formatThousands(value: number) {
  return `${Math.round(value / 1000).toLocaleString("id-ID")} rb`;
}

export function CompetitorProductCategoryClient({
  category,
}: {
  category: CompetitorProductCategoryDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<CompetitorProductTrackRow | null>(null);

  const unreadAlerts = category.alerts.filter((a) => !a.isRead).length;
  const hasTracks = category.tracks.length > 0;

  const stats = useMemo(() => {
    const prices = category.tracks
      .map((t) => t.currentPrice)
      .filter((p): p is number => p != null);
    const ratings = category.tracks
      .map((t) => t.rating)
      .filter((r): r is number => r != null);
    return {
      avgPrice: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      promoCount: category.tracks.filter((t) => t.hasPromo).length,
      errorCount: category.tracks.filter((t) => t.scrapeError).length,
    };
  }, [category.tracks]);

  const counts = useMemo(() => countRunTones(category.tracks, toneOf), [category.tracks]);

  const filtered = useMemo(
    () =>
      filterRuns(category.tracks, {
        search,
        status,
        text: (t) =>
          `${t.name} ${t.brand ?? ""} ${t.shopName ?? ""} ${MARKETPLACE_LABELS[t.marketplace]}`,
        tone: toneOf,
      }),
    [category.tracks, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    name: (t) => t.name,
    price: (t) => t.currentPrice,
    rating: (t) => t.rating,
    reviews: (t) => t.reviewCount,
  });

  const facts: Fact[] = [
    {
      label: "Produk dipantau",
      value: category.tracks.length.toLocaleString("id-ID"),
      hint:
        stats.errorCount > 0 ? `${stats.errorCount} gagal ditarik` : "Semua berhasil ditarik",
    },
    {
      label: "Harga rata-rata",
      value: stats.avgPrice != null ? formatRp(Math.round(stats.avgPrice)) : "—",
      hint:
        stats.minPrice != null && stats.maxPrice != null
          ? `${formatThousands(stats.minPrice)} sampai ${formatThousands(stats.maxPrice)}`
          : undefined,
    },
    {
      label: "Rating rata-rata",
      value: stats.avgRating != null ? stats.avgRating.toFixed(1) : "—",
    },
    {
      label: "Sedang promo",
      value: stats.promoCount.toLocaleString("id-ID"),
      hint: "produk",
    },
    {
      label: "Alert belum dibaca",
      value: unreadAlerts.toLocaleString("id-ID"),
    },
  ];

  function handleRefreshAll() {
    startTransition(async () => {
      try {
        await refreshCompetitorProductCategory(category.id);
        toast.success("Semua produk ditarik ulang di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Produk gagal ditarik ulang. Coba lagi sebentar."));
      }
    });
  }

  function handleRefreshTrack(track: CompetitorProductTrackRow) {
    startTransition(async () => {
      try {
        await refreshCompetitorProductTrack(track.id);
        toast.success(`"${track.name}" ditarik ulang di background.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, `"${track.name}" gagal ditarik ulang. Coba lagi sebentar.`));
      }
    });
  }

  function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteCompetitorProductTrack(target.id);
        toast.success(`"${target.name}" dihapus.`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, `"${target.name}" gagal dihapus.`));
      }
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      try {
        await markAllCompetitorProductAlertsRead(category.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Alert gagal ditandai dibaca."));
      }
    });
  }

  function handleMarkRead(alert: { id: string }) {
    startTransition(async () => {
      try {
        await markCompetitorProductAlertRead(alert.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Alert gagal ditandai dibaca."));
      }
    });
  }

  return (
    <ResearchHubDetailPage
      backHref="/research-hub/competitor-tracker/products"
      backLabel="Competitor products"
      title={category.name}
      description={
        category.description ??
        "Pantau harga, rating, dan promo produk kompetitor di kategori ini."
      }
      right={
        <>
          {hasTracks ? (
            <Button size="sm" variant="outline" disabled={pending} onClick={handleRefreshAll}>
              <RefreshCw aria-hidden />
              Tarik ulang semua
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus aria-hidden />
            Tambah produk
          </Button>
        </>
      }
    >
      {hasTracks ? (
        <section aria-label="Ringkasan kategori" className="border-border border-y py-5">
          <FactList facts={facts} className="xl:grid-cols-5" />
        </section>
      ) : null}

      <DetailSection
        id="ct-tracks"
        title="Produk dipantau"
        description={hasTracks ? "Pilih produk untuk melihat riwayat harga dan penjualan." : undefined}
      >
        {!hasTracks ? (
          <ResearchPanelEmpty
            icon={Package}
            title="Belum ada produk di kategori ini"
            description="Tambahkan URL produk kompetitor dari Shopee, Tokopedia, Lazada, atau TikTok Shop untuk mulai memantau harganya."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Tambah produk
              </Button>
            }
          />
        ) : (
          <>
            <ResearchFilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Cari produk, brand, atau toko…"
              status={status}
              onStatusChange={setStatus}
              statusCounts={counts}
              statusLabels={STATUS_LABELS}
              resultCount={filtered.length}
              totalCount={category.tracks.length}
              onReset={() => {
                setSearch("");
                setStatus("all");
              }}
            />
            {sorted.length === 0 ? (
              <p className="rh-meta border-border rounded-xl border border-dashed px-5 py-8 text-center text-[13px]">
                Tidak ada produk yang cocok dengan filter ini.
              </p>
            ) : (
              <ResearchTable maxHeight="70vh">
                <TableHeader sticky>
                  <TableRow>
                    <SortableHead sortKey="name" sort={sort} onSort={toggle}>
                      Produk
                    </SortableHead>
                    <TableHead>Marketplace</TableHead>
                    <TableHead>Status</TableHead>
                    <SortableHead sortKey="price" sort={sort} onSort={toggle} align="right">
                      Harga
                    </SortableHead>
                    <SortableHead sortKey="rating" sort={sort} onSort={toggle} align="right">
                      Rating
                    </SortableHead>
                    <SortableHead sortKey="reviews" sort={sort} onSort={toggle} align="right">
                      Review
                    </SortableHead>
                    <TableHead className="w-0 text-right">
                      <span className="sr-only">Aksi</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((track) => {
                    const tone = toneOf(track);
                    return (
                      <TableRow key={track.id}>
                        <TableCell className="max-w-[26rem] whitespace-normal">
                          <div className="flex items-center gap-3">
                            <div className="border-border/60 bg-muted/20 size-10 shrink-0 overflow-hidden rounded-lg border">
                              <ProductDiscoveryProductThumb
                                imageUrl={track.imageUrl}
                                name={track.name}
                                className="size-full"
                              />
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/research-hub/competitor-tracker/products/${category.id}/tracks/${track.id}`}
                                className="text-foreground focus-visible:ring-ring line-clamp-2 rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                              >
                                {track.name}
                              </Link>
                              {track.brand || track.shopName ? (
                                <p className="rh-meta truncate">
                                  {track.shopName ?? track.brand}
                                </p>
                              ) : null}
                              {track.scrapeError ? (
                                <p className="mt-0.5 line-clamp-2 text-xs text-rose-700 dark:text-rose-300">
                                  {track.scrapeError}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <MarketplaceLogo marketplace={track.marketplace} className="size-4" />
                            {MARKETPLACE_LABELS[track.marketplace]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <RunStatusBadge tone={tone} label={STATUS_LABELS[tone]} />
                          {track.lastScrapedAt ? (
                            <p className="rh-meta mt-0.5">
                              <time
                                dateTime={track.lastScrapedAt}
                                title={new Date(track.lastScrapedAt).toLocaleString("id-ID")}
                              >
                                {formatRelativeTime(new Date(track.lastScrapedAt))}
                              </time>
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="rh-num text-right">
                          {track.currentPrice != null ? (
                            formatRp(track.currentPrice)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {track.hasPromo ? (
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                              {track.promoText ?? "Promo"}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="rh-num text-right">
                          {track.rating != null ? (
                            track.rating.toFixed(1)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="rh-num text-right">
                          {track.reviewCount.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => handleRefreshTrack(track)}
                              aria-label={`Tarik ulang "${track.name}"`}
                              title="Tarik ulang"
                            >
                              <RefreshCw aria-hidden />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              render={
                                <a
                                  href={track.productUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Buka "${track.name}" di ${MARKETPLACE_LABELS[track.marketplace]}`}
                                  title="Buka di marketplace"
                                />
                              }
                            >
                              <ExternalLink aria-hidden />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              disabled={pending}
                              onClick={() => setDeleteTarget(track)}
                              aria-label={`Hapus "${track.name}"`}
                              title="Hapus"
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
          </>
        )}
      </DetailSection>

      {hasTracks || category.alerts.length > 0 ? (
        <DetailSection
          id="ct-category-alerts"
          title="Alert"
          description="Perubahan harga, rating, dan promo produk di kategori ini."
          action={
            unreadAlerts > 0 ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={handleMarkAllRead}>
                Tandai semua dibaca
              </Button>
            ) : null
          }
        >
          {category.alerts.length === 0 ? (
            <ResearchPanelEmpty
              icon={Bell}
              title="Belum ada alert"
              description="Alert muncul saat refresh menemukan perubahan harga, rating, atau promo."
            />
          ) : (
            <CompetitorAlertList
              alerts={category.alerts}
              pending={pending}
              onMarkRead={handleMarkRead}
            />
          )}
        </DetailSection>
      ) : null}

      <AddProductDialog
        categoryId={category.id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Hapus "${deleteTarget?.name ?? ""}"?`}
        description="Produk ini berhenti dipantau. Riwayat harga dan penjualannya ikut terhapus dari kategori. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus produk"
        pending={pending}
        onConfirm={handleDelete}
      />
    </ResearchHubDetailPage>
  );
}
