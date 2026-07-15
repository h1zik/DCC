"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { ResearchMarketplace } from "@prisma/client";
import {
  ArrowUpRight,
  Bell,
  ExternalLink,
  ImageIcon,
  Package,
} from "lucide-react";
import { harvestCompetitorProductVisualsAction } from "@/actions/brand-visual-research";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import { BrandCompetitorTrackerModeNav } from "@/components/brand-hub/brand-competitor-tracker-mode-nav";
import { lab, LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
import { BrandHubDetailPage } from "@/components/brand-hub/brand-hub-list-page";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { MARKETPLACE_LABELS, formatRp } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type BrandCompetitorProductTrackRow = {
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
};

export type BrandCompetitorProductAlertRow = {
  id: string;
  type: string;
  message: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
};

export type BrandCompetitorProductCategoryDetail = {
  id: string;
  name: string;
  description: string | null;
  tracks: BrandCompetitorProductTrackRow[];
  alerts: BrandCompetitorProductAlertRow[];
};

export function BrandCompetitorProductCategoryClient({
  category,
}: {
  category: BrandCompetitorProductCategoryDetail;
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
  const [pending, startTransition] = useTransition();

  const unreadAlerts = category.alerts.filter((a) => !a.isRead).length;
  const imageCount = category.tracks.filter((t) => t.imageUrl).length;

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
    };
  }, [category.tracks]);

  return (
    <BrandHubDetailPage
      icon={Package}
      backHref={brandHubHref("/brand-hub/competitor-tracker/products", brandId)}
      title={category.name}
      description={
        category.description ??
        "Benchmark produk kompetitor spesifik — harga, rating, promo."
      }
      right={
        <>
          <Badge variant="secondary" className="text-[10px]">
            Dikelola Market Analyst
          </Badge>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={pending || imageCount === 0}
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await harvestCompetitorProductVisualsAction(
                    category.id,
                    brandId,
                  );
                  toast.success(
                    `${result.harvested} visual kompetitor di-harvest ke library.`,
                  );
                  router.refresh();
                } catch (err) {
                  toast.error(
                    actionErrorMessage(err, "Gagal harvest visual."),
                  );
                }
              })
            }
          >
            <ImageIcon className="size-4" />
            Harvest Visual ({imageCount})
          </Button>
        </>
      }
    >
      <BrandCompetitorTrackerModeNav />

      {/* Papan hero bento */}
      {category.tracks.length > 0 ? (
        <div className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}>
          <div className="bento-tile border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
            <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
              Produk dipantau
            </span>
            <span className="bento-value text-white dark:text-pink-950">
              {category.tracks.length.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-pink-100/90 dark:text-pink-900/80">
              {imageCount > 0
                ? `${imageCount} visual siap harvest ke library`
                : "belum ada visual siap harvest"}
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

          <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
            <span className="text-[11.5px] font-semibold text-pink-700/70 dark:text-pink-300/70">
              Rating rata-rata
            </span>
            <span className="bento-value text-pink-900 dark:text-pink-300">
              {stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"}
            </span>
            <span className="text-[11px] font-medium text-pink-700/60 dark:text-pink-300/60">
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
          description="Tambahkan produk kompetitor di Research Hub → Competitor Tracker → By Products."
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
                  href={brandHubHref(
                    `/brand-hub/competitor-tracker/products/${category.id}/tracks/${track.id}`,
                    brandId,
                  )}
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
                    <p className="text-muted-foreground truncate text-xs">
                      {MARKETPLACE_LABELS[track.marketplace]}
                      {track.brand ? ` · ${track.brand}` : ""}
                      {track.shopName ? ` · ${track.shopName}` : ""}
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
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-end gap-1 border-t px-3 py-2">
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
                    Buka di marketplace
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </LabSection>
      )}

      {category.alerts.length > 0 ? (
        <LabSection title="Alert" description="Perubahan harga, rating, dan promo.">
          <div className="grid gap-2">
            {category.alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  lab.card,
                  "flex items-start gap-3 p-4 text-sm",
                  alert.isRead && "opacity-60",
                )}
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
              </div>
            ))}
          </div>
        </LabSection>
      ) : null}
    </BrandHubDetailPage>
  );
}
