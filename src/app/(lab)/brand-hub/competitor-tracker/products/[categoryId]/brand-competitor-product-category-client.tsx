"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ResearchMarketplace } from "@prisma/client";
import {
  Bell,
  ChevronLeft,
  ExternalLink,
  ImageIcon,
} from "lucide-react";
import { harvestCompetitorProductVisualsAction } from "@/actions/brand-visual-research";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { ProductDiscoveryProductThumb } from "@/components/research-hub/product-discovery-product-thumb";
import { BrandCompetitorTrackerModeNav } from "@/components/brand-hub/brand-competitor-tracker-mode-nav";
import {
  lab,
  LabEmptyState,
  LabSection,
  LabStatChip,
} from "@/components/lab/lab-primitives";
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

  return (
    <div className="flex flex-col gap-6">
      <BrandCompetitorTrackerModeNav />

      <Button
        size="sm"
        variant="ghost"
        className="w-fit gap-1 px-0"
        render={
          <Link
            href={brandHubHref(
              "/brand-hub/competitor-tracker/products",
              brandId,
            )}
          />
        }
      >
        <ChevronLeft className="size-4" />
        Semua kategori
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {category.name}
          </h1>
          {category.description ? (
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              {category.description}
            </p>
          ) : null}
        </div>
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
      </div>

      <div className="flex flex-wrap gap-2">
        <LabStatChip
          label="Produk"
          value={category.tracks.length.toLocaleString("id-ID")}
          tone="accent"
        />
        <LabStatChip
          label="Visual"
          value={imageCount.toLocaleString("id-ID")}
        />
        <LabStatChip
          label="Alert"
          value={unreadAlerts.toLocaleString("id-ID")}
          tone={unreadAlerts > 0 ? "warning" : "neutral"}
        />
      </div>

      {category.tracks.length === 0 ? (
        <LabEmptyState
          title="Belum ada produk"
          description="Tambahkan produk kompetitor di Research Hub → Competitor Tracker → By Products."
        />
      ) : (
        <LabSection
          title="Produk dipantau"
          description="Klik produk untuk riwayat harga & penjualan."
        >
          <div className="grid gap-3">
            {category.tracks.map((track) => (
              <div
                key={track.id}
                className={cn(
                  lab.panel,
                  "flex flex-col gap-3 p-4 sm:flex-row sm:items-center",
                )}
              >
                <Link
                  href={brandHubHref(
                    `/brand-hub/competitor-tracker/products/${category.id}/tracks/${track.id}`,
                    brandId,
                  )}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/20">
                    <ProductDiscoveryProductThumb
                      imageUrl={track.imageUrl}
                      name={track.name}
                      className="size-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{track.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {MARKETPLACE_LABELS[track.marketplace]}
                      {track.brand ? ` · ${track.brand}` : ""}
                      {track.shopName ? ` · ${track.shopName}` : ""}
                    </p>
                    <p className="mt-1 text-sm tabular-nums">
                      {track.currentPrice != null
                        ? formatRp(track.currentPrice)
                        : "—"}
                      {track.rating != null
                        ? ` · ★ ${track.rating.toFixed(1)}`
                        : ""}
                      {track.reviewCount > 0
                        ? ` · ${track.reviewCount.toLocaleString("id-ID")} review`
                        : ""}
                    </p>
                  </div>
                </Link>

                <Button
                  size="sm"
                  variant="ghost"
                  render={<a href={track.productUrl} target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink className="size-3.5" />
                </Button>
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
                  lab.panel,
                  "flex items-start gap-3 p-3 text-sm",
                  !alert.isRead && "border-amber-500/30 bg-amber-500/5",
                )}
              >
                <Bell className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </LabSection>
      ) : null}
    </div>
  );
}
