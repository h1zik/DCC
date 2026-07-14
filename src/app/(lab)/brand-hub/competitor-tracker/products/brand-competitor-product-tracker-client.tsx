"use client";

import Link from "next/link";
import { Bell, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandCompetitorTrackerModeNav } from "@/components/brand-hub/brand-competitor-tracker-mode-nav";
import {
  lab,
  LabEmptyState,
  LabSection,
  LabStatChip,
} from "@/components/lab/lab-primitives";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
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

export function BrandCompetitorProductTrackerClient({
  categories,
}: {
  categories: BrandCompetitorProductCategoryCard[];
}) {
  const brandId = useBrandHubBrandId();

  const totalProducts = categories.reduce((sum, c) => sum + c.productCount, 0);
  const totalAlerts = categories.reduce((sum, c) => sum + c.unreadAlerts, 0);

  return (
    <div className="flex flex-col gap-6">
      <BrandCompetitorTrackerModeNav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <LabStatChip
            label="Kategori"
            value={categories.length.toLocaleString("id-ID")}
            tone="accent"
          />
          <LabStatChip
            label="Produk"
            value={totalProducts.toLocaleString("id-ID")}
          />
          <LabStatChip
            label="Alert"
            value={totalAlerts.toLocaleString("id-ID")}
            tone={totalAlerts > 0 ? "warning" : "neutral"}
          />
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
        <LabSection
          title="Kategori produk kompetitor"
          description="Benchmark produk individual — pantau harga, rating, dan promo untuk kebutuhan brand & creative."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={brandHubHref(
                  `/brand-hub/competitor-tracker/products/${category.id}`,
                  brandId,
                )}
                className={cn(
                  lab.panel,
                  "group flex flex-col gap-3 p-4 transition-colors hover:border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_35%,var(--border))]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold leading-snug group-hover:text-[var(--lab-accent,var(--primary))]">
                      {category.name}
                    </h3>
                    {category.description ? (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {category.description}
                      </p>
                    ) : null}
                  </div>
                  {category.unreadAlerts > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                      <Bell className="size-3" />
                      {category.unreadAlerts}
                    </span>
                  ) : null}
                </div>

                <p className="text-muted-foreground text-sm tabular-nums">
                  {category.productCount} produk dipantau
                </p>
              </Link>
            ))}
          </div>
        </LabSection>
      )}
    </div>
  );
}
