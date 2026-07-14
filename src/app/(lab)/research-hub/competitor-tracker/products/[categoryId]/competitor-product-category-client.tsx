"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ResearchMarketplace } from "@prisma/client";
import {
  Bell,
  ChevronLeft,
  ExternalLink,
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
import {
  lab,
  LabEmptyState,
  LabSection,
  LabStatChip,
} from "@/components/lab/lab-primitives";
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
    <div className="flex flex-col gap-6">
      <CompetitorTrackerModeNav />

      <Button
        size="sm"
        variant="ghost"
        className="w-fit gap-1 px-0"
        render={
          <Link href="/research-hub/competitor-tracker/products" />
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
        <div className="flex flex-wrap gap-2">
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
                      {MARKETPLACE_LABELS[marketplace]}
                    </SelectTrigger>
                    <SelectContent>
                      {MARKETPLACE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
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
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <LabStatChip
          label="Produk"
          value={category.tracks.length.toLocaleString("id-ID")}
          tone="accent"
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
          description="Tambahkan URL produk kompetitor (Shopee, Tokopedia, Lazada, TikTok Shop) ke kategori ini."
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
                className={cn(
                  lab.panel,
                  "flex flex-col gap-3 p-4 sm:flex-row sm:items-center",
                )}
              >
                <Link
                  href={`/research-hub/competitor-tracker/products/${category.id}/tracks/${track.id}`}
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
                    {track.scrapeError ? (
                      <p className="text-destructive mt-1 text-xs">
                        {track.scrapeError}
                      </p>
                    ) : null}
                  </div>
                </Link>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
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
                    <RefreshCw className="size-3.5" />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    render={<a href={track.productUrl} target="_blank" rel="noreferrer" />}
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={pending}
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
                    <Trash2 className="size-3.5" />
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
                  lab.panel,
                  "flex w-full items-start gap-3 p-3 text-left text-sm",
                  !alert.isRead && "border-amber-500/30 bg-amber-500/5",
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
                <Bell className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <span>{alert.message}</span>
              </button>
            ))}
          </div>
        </LabSection>
      ) : null}
    </div>
  );
}
