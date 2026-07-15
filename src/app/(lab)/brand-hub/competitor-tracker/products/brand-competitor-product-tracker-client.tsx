"use client";

import Link from "next/link";
import { ArrowUpRight, Bell, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandCompetitorTrackerModeNav } from "@/components/brand-hub/brand-competitor-tracker-mode-nav";
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { formatRelativeTime } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type BrandCompetitorProductCategoryCard = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
  unreadAlerts: number;
  updatedAt: string;
};

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        active
          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function CardStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

export function BrandCompetitorProductTrackerClient({
  categories,
}: {
  categories: BrandCompetitorProductCategoryCard[];
}) {
  const brandId = useBrandHubBrandId();

  const totalProducts = categories.reduce((sum, c) => sum + c.productCount, 0);
  const totalAlerts = categories.reduce((sum, c) => sum + c.unreadAlerts, 0);
  const activeCount = categories.filter((c) => c.isActive).length;

  return (
    <div className="flex flex-col gap-6">
      <BrandCompetitorTrackerModeNav />

      {/* Strip ringkasan */}
      {categories.length > 0 ? (
        <div className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}>
          <div className="bento-tile border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
            <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
              Kategori produk
            </span>
            <span className="bento-value text-white dark:text-pink-950">
              {categories.length.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-pink-100/90 dark:text-pink-900/80">
              {activeCount} aktif dipantau
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Produk dipantau</span>
            <span className="bento-value">
              {totalProducts.toLocaleString("id-ID")}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              URL produk lintas marketplace
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
            <span className="text-[11.5px] font-semibold text-pink-700/70 dark:text-pink-300/70">
              Rata-rata per kategori
            </span>
            <span className="bento-value text-pink-900 dark:text-pink-300">
              {categories.length > 0
                ? Math.round(totalProducts / categories.length).toLocaleString(
                    "id-ID",
                  )
                : "—"}
            </span>
            <span className="text-[11px] font-medium text-pink-700/60 dark:text-pink-300/60">
              produk per kategori
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Alert belum dibaca
            </span>
            <span className="bento-value text-amber-900 dark:text-amber-300">
              {totalAlerts.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-300/60">
              harga, rating, dan promo
            </span>
          </div>
        </div>
      ) : null}

      {/* Header daftar */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Kategori</h2>
            <p className={lab.sectionDesc}>
              {categories.length === 0
                ? "Data produk kompetitor dikelola Market Analyst di Research Hub."
                : `${categories.length} kategori · ${totalProducts.toLocaleString("id-ID")} produk kompetitor untuk benchmark brand & creative.`}
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            Dikelola Market Analyst
          </Badge>
        </div>

        {categories.length === 0 ? (
          <LabEmptyState
            icon={Package}
            title="Belum ada kategori produk kompetitor"
            description="Data produk kompetitor dibuat di Research Hub → Competitor Tracker → By Products."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category, index) => (
              <Link
                key={category.id}
                href={brandHubHref(
                  `/brand-hub/competitor-tracker/products/${category.id}`,
                  brandId,
                )}
                className={cn(
                  lab.card,
                  lab.entrance,
                  "group flex flex-col gap-4 p-5",
                )}
                style={
                  index > 0 && index < 9
                    ? { animationDelay: `${index * 40}ms` }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/12 text-pink-600 dark:text-pink-300"
                      aria-hidden
                    >
                      <Package className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                        <span className="truncate">{category.name}</span>
                        <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                      </p>
                      {category.description ? (
                        <p className="text-muted-foreground truncate text-xs">
                          {category.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <StatusDot active={category.isActive} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <CardStat
                    label="Produk"
                    value={category.productCount.toLocaleString("id-ID")}
                  />
                  <CardStat
                    label="Alert"
                    value={
                      category.unreadAlerts > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Bell className="size-3" aria-hidden />
                          {category.unreadAlerts.toLocaleString("id-ID")}
                        </span>
                      ) : (
                        "0"
                      )
                    }
                  />
                  <CardStat
                    label="Update"
                    value={formatRelativeTime(new Date(category.updatedAt))}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
