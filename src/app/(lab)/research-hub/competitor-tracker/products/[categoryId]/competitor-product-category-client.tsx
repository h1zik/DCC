"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ResearchMarketplace } from "@prisma/client";
import {
  ArrowUpRight,
  Bell,
  ExternalLink,
  Package,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  addCompetitorProductTrack,
  deleteCompetitorProductTrack,
  markAllCompetitorProductAlertsRead,
  markCompetitorProductAlertRead,
  refreshCompetitorProductCategory,
  refreshCompetitorProductTrack,
} from "@/actions/research-competitor-product";
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
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import { CompetitorTrackerModeNav } from "@/components/research-hub/competitor-tracker-mode-nav";
import { lab, LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
import {
  MarketplaceBadge,
  MarketplaceLogo,
} from "@/components/research-hub/marketplace-logo";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { MARKETPLACE_LABELS, formatRp } from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { cn } from "@/lib/utils";

const MARKETPLACE_ITEMS: SelectItemDef[] = Object.entries(MARKETPLACE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

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

export function CompetitorProductCategoryClient({
  category,
}: {
  category: CompetitorProductCategoryDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productUrl, setProductUrl] = useState("");
  const [marketplace, setMarketplace] = useState<ResearchMarketplace>(
    ResearchMarketplace.SHOPEE,
  );

  const unreadAlerts = category.alerts.filter((a) => !a.isRead).length;

  /* --------------------------- Statistik papan hero --------------------------- */
  const stats = useMemo(() => {
    const prices = category.tracks
      .map((t) => t.currentPrice)
      .filter((p): p is number => p != null);
    const ratings = category.tracks
      .map((t) => t.rating)
      .filter((r): r is number => r != null);
    return {
      avgPrice: prices.length
        ? prices.reduce((a, b) => a + b, 0) / prices.length
        : null,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      avgRating: ratings.length
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null,
      promoCount: category.tracks.filter((t) => t.hasPromo).length,
      errorCount: category.tracks.filter((t) => t.scrapeError).length,
    };
  }, [category.tracks]);

  function handleAddProduct() {
    startTransition(async () => {
      try {
        const result = await addCompetitorProductTrack({
          categoryId: category.id,
          productUrl,
          marketplace,
        });
        toast.success("Produk ditambahkan.");
        setDialogOpen(false);
        setProductUrl("");
        router.push(
          `/research-hub/competitor-tracker/products/${category.id}/tracks/${result.id}`,
        );
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menambah produk."));
      }
    });
  }

  return (
    <ResearchHubDetailPage
      icon={Package}
      backHref="/research-hub/competitor-tracker/products"
      title={category.name}
      description={
        category.description ??
        "Pantau URL produk kompetitor spesifik — harga, rating, promo."
      }
      right={
        <>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await refreshCompetitorProductCategory(category.id);
                  toast.success("Refresh semua produk dijadwalkan.");
                  router.refresh();
                } catch (err) {
                  toast.error(actionErrorMessage(err, "Gagal refresh."));
                }
              })
            }
          >
            <RefreshCw className="size-4" />
            Refresh Semua
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" />
                  Tambah Produk
                </Button>
              }
            />
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Tambah Produk via URL</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground text-sm">
                Nama produk diisi otomatis dari data marketplace setelah scrape.
              </p>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Marketplace</Label>
                  <Select
                    value={marketplace}
                    items={MARKETPLACE_ITEMS}
                    onValueChange={(v) => {
                      if (v) setMarketplace(v as ResearchMarketplace);
                    }}
                  >
                    <SelectTrigger>
                      <MarketplaceBadge marketplace={marketplace} />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKETPLACE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          <MarketplaceBadge marketplace={item.value} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-url">URL produk</Label>
                  <Input
                    id="product-url"
                    placeholder="https://shopee.co.id/product/..."
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAddProduct}
                  disabled={pending || !productUrl.trim()}
                >
                  {pending ? "Mengambil data…" : "Tambah Produk"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      <CompetitorTrackerModeNav />

      {/* Papan hero bento */}
      {category.tracks.length > 0 ? (
        <div className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}>
          <div className="bento-tile border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Produk dipantau
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {category.tracks.length.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-violet-100/90 dark:text-violet-900/80">
              {stats.errorCount > 0
                ? `${stats.errorCount} gagal scrape — cek daftar di bawah`
                : "semua ter-scrape tanpa error"}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Harga rata-rata</span>
            <span className="bento-value text-2xl">
              {stats.avgPrice != null ? formatRp(Math.round(stats.avgPrice)) : "—"}
            </span>
            {stats.minPrice != null && stats.maxPrice != null ? (
              <span className="text-muted-foreground text-[11px] font-medium">
                rentang {Math.round(stats.minPrice / 1000)}–
                {Math.round(stats.maxPrice / 1000)}rb
              </span>
            ) : null}
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Rating rata-rata
            </span>
            <span className="bento-value text-violet-900 dark:text-violet-300">
              {stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"}
            </span>
            <span className="text-[11px] font-medium text-violet-700/60 dark:text-violet-300/60">
              {stats.promoCount > 0
                ? `${stats.promoCount} produk sedang promo`
                : "tidak ada promo aktif"}
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Alert belum dibaca
            </span>
            <span className="bento-value text-amber-900 dark:text-amber-300">
              {unreadAlerts.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-300/60">
              harga, rating, dan promo
            </span>
          </div>
        </div>
      ) : null}

      {category.tracks.length === 0 ? (
        <LabEmptyState
          icon={Package}
          title="Belum ada produk"
          description="Tambahkan URL produk kompetitor (Shopee, Tokopedia, Lazada, TikTok Shop) ke kategori ini."
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Tambah Produk
            </Button>
          }
        />
      ) : (
        <LabSection
          title="Produk Dipantau"
          description="Klik produk untuk riwayat harga & penjualan."
        >
          <div className="grid gap-3">
            {category.tracks.map((track) => (
              <div
                key={track.id}
                className={cn(lab.card, "group flex flex-col p-0")}
              >
                <Link
                  href={`/research-hub/competitor-tracker/products/${category.id}/tracks/${track.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4 p-4"
                >
                  <div className="border-border/50 bg-muted/20 size-14 shrink-0 overflow-hidden rounded-xl border">
                    <ProductDiscoveryProductThumb
                      imageUrl={track.imageUrl}
                      name={track.name}
                      className="size-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground flex items-center gap-1 font-bold leading-snug tracking-tight">
                      <span className="line-clamp-1">{track.name}</span>
                      <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                      <MarketplaceLogo
                        marketplace={track.marketplace}
                        className="size-3.5"
                      />
                      <span className="truncate">
                        {MARKETPLACE_LABELS[track.marketplace]}
                        {track.brand ? ` · ${track.brand}` : ""}
                        {track.shopName ? ` · ${track.shopName}` : ""}
                      </span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-extrabold tabular-nums tracking-tight">
                        {track.currentPrice != null
                          ? formatRp(track.currentPrice)
                          : "—"}
                      </span>
                      {track.rating != null ? (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          ★ {track.rating.toFixed(1)}
                        </span>
                      ) : null}
                      {track.reviewCount > 0 ? (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {track.reviewCount.toLocaleString("id-ID")} review
                        </span>
                      ) : null}
                      {track.hasPromo ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          {track.promoText ?? "Promo"}
                        </span>
                      ) : null}
                    </div>
                    {track.scrapeError ? (
                      <p className="mt-1 inline-flex items-center rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        {track.scrapeError}
                      </p>
                    ) : null}
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-end gap-1 border-t px-3 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await refreshCompetitorProductTrack(track.id);
                          toast.success("Refresh produk dijadwalkan.");
                          router.refresh();
                        } catch (err) {
                          toast.error(actionErrorMessage(err, "Gagal refresh."));
                        }
                      })
                    }
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    render={
                      <a
                        href={track.productUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Buka ${track.name} di marketplace`}
                      />
                    }
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={pending}
                    aria-label="Hapus produk"
                    onClick={() =>
                      startTransition(async () => {
                        if (!confirm(`Hapus "${track.name}" dari kategori?`)) {
                          return;
                        }
                        try {
                          await deleteCompetitorProductTrack(track.id);
                          toast.success("Produk dihapus.");
                          router.refresh();
                        } catch (err) {
                          toast.error(actionErrorMessage(err, "Gagal menghapus."));
                        }
                      })
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </LabSection>
      )}

      {category.alerts.length > 0 ? (
        <LabSection
          title="Alert"
          description="Perubahan harga, rating, dan promo."
          action={
            unreadAlerts > 0 ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await markAllCompetitorProductAlertsRead(category.id);
                    router.refresh();
                  })
                }
              >
                Tandai semua dibaca
              </Button>
            ) : null
          }
        >
          <div className="grid gap-2">
            {category.alerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                className={cn(
                  lab.card,
                  "flex w-full items-start gap-3 p-4 text-left text-sm",
                  alert.isRead && "opacity-60",
                )}
                onClick={() =>
                  startTransition(async () => {
                    if (!alert.isRead) {
                      await markCompetitorProductAlertRead(alert.id);
                      router.refresh();
                    }
                  })
                }
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                    alert.isRead
                      ? "bg-muted text-muted-foreground"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                  )}
                  aria-hidden
                >
                  <Bell className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{alert.message}</span>
                  <span className="text-muted-foreground mt-0.5 block text-[10px]">
                    {new Date(alert.createdAt).toLocaleString("id-ID")}
                  </span>
                </span>
                {!alert.isRead ? (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    Baru
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </LabSection>
      ) : null}
    </ResearchHubDetailPage>
  );
}
