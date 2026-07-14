"use client";

import Link from "next/link";
import { ResearchMarketplace } from "@prisma/client";
import { Bell, Package, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandCompetitorTrackerModeNav } from "@/components/brand-hub/brand-competitor-tracker-mode-nav";
import {
  lab,
  LabEmptyState,
  LabSection,
  LabStatChip,
} from "@/components/lab/lab-primitives";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type CompetitorCard = {
  id: string;
  name: string;
  brand: string;
  category: string;
  marketplace: ResearchMarketplace;
  shopUrl: string;
  isActive: boolean;
  skuCount: number;
  imageSkuCount: number;
  avgRating: number | null;
  unreadAlerts: number;
};

export function BrandCompetitorTrackerClient({
  competitors,
}: {
  competitors: CompetitorCard[];
}) {
  const brandId = useBrandHubBrandId();

  const totalSkus = competitors.reduce((sum, c) => sum + c.skuCount, 0);
  const totalVisual = competitors.reduce((sum, c) => sum + c.imageSkuCount, 0);
  const totalAlerts = competitors.reduce((sum, c) => sum + c.unreadAlerts, 0);
  const activeCount = competitors.filter((c) => c.isActive).length;

  return (
    <div className="flex flex-col gap-6">
      <BrandCompetitorTrackerModeNav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <LabStatChip
            label="Kompetitor"
            value={competitors.length.toLocaleString("id-ID")}
            tone="accent"
          />
          <LabStatChip
            label="Aktif"
            value={activeCount.toLocaleString("id-ID")}
            tone="success"
          />
          <LabStatChip
            label="Total SKU"
            value={totalSkus.toLocaleString("id-ID")}
          />
          <LabStatChip
            label="Visual"
            value={totalVisual.toLocaleString("id-ID")}
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

      <LabSection
        title="Kompetitor dipantau"
        description="Pantau harga, SKU baru, rating, dan promo kompetitor — data dari Research Hub."
      >
        {competitors.length === 0 ? (
          <LabEmptyState
            icon={Target}
            title="Belum ada kompetitor"
            description="Mintakan Market Analyst menambahkan brand kompetitor di Research Hub. Data akan muncul di sini secara otomatis."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {competitors.map((c, index) => (
              <article
                key={c.id}
                className={cn(lab.panel, lab.cardHover, lab.entrance, "relative")}
                style={
                  index > 0 && index < 9
                    ? { animationDelay: `${index * 40}ms` }
                    : undefined
                }
              >
                {c.unreadAlerts > 0 ? (
                  <span className="bg-primary text-primary-foreground absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    <Bell className="size-3" aria-hidden />
                    {c.unreadAlerts}
                  </span>
                ) : null}

                <Link
                  href={brandHubHref(
                    `/brand-hub/competitor-tracker/${c.id}`,
                    brandId,
                  )}
                  className="block"
                >
                  <p className="text-foreground pr-16 font-semibold">{c.name}</p>
                  <p className="text-muted-foreground text-xs">{c.brand}</p>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {MARKETPLACE_LABELS[c.marketplace]} · {c.category}
                  </p>
                </Link>

                <div className="mt-3 flex flex-wrap gap-2">
                  <LabStatChip
                    label="SKU"
                    value={c.skuCount.toLocaleString("id-ID")}
                    tone="accent"
                  />
                  <LabStatChip
                    label="Visual"
                    value={c.imageSkuCount.toLocaleString("id-ID")}
                  />
                  <LabStatChip
                    label="Rating"
                    value={c.avgRating != null ? c.avgRating.toFixed(1) : "—"}
                  />
                </div>

                {!c.isActive ? (
                  <span className="text-muted-foreground mt-2 block text-[10px] uppercase">
                    Nonaktif
                  </span>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </LabSection>
    </div>
  );
}
