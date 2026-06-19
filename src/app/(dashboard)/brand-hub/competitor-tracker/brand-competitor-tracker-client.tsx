"use client";

import Link from "next/link";
import { ResearchMarketplace } from "@prisma/client";
import { Bell, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandHubEmptyState, hub } from "@/components/brand-hub/brand-hub-primitives";
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
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {competitors.length} kompetitor dari Research Hub
        </p>
        <Badge variant="secondary" className="text-[10px]">
          Dikelola Market Analyst
        </Badge>
      </div>

      {competitors.length === 0 ? (
        <BrandHubEmptyState
          icon={Target}
          title="Belum ada data kompetitor"
          description="Mintakan Market Analyst menambahkan kompetitor di Research Hub. Data akan muncul di sini secara otomatis."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {competitors.map((c) => (
            <article key={c.id} className={cn(hub.card, hub.cardHover, "relative p-5")}>
              {c.unreadAlerts > 0 ? (
                <span className="bg-primary text-primary-foreground absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  <Bell className="size-3" aria-hidden />
                  {c.unreadAlerts}
                </span>
              ) : null}
              <Link
                href={`/brand-hub/competitor-tracker/${c.id}`}
                className="block"
              >
                <p className="text-foreground pr-16 font-semibold">{c.name}</p>
                <p className="text-muted-foreground text-xs">{c.brand}</p>
                <p className="text-muted-foreground mt-2 text-xs">
                  {MARKETPLACE_LABELS[c.marketplace]} · {c.category}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span>
                    <span className="text-muted-foreground text-xs">SKU </span>
                    <span className="font-medium tabular-nums">{c.skuCount}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground text-xs">Visual </span>
                    <span className="font-medium tabular-nums">{c.imageSkuCount}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground text-xs">Rating </span>
                    <span className="font-medium tabular-nums">
                      {c.avgRating != null ? c.avgRating.toFixed(1) : "—"}
                    </span>
                  </span>
                </div>
              </Link>
              {!c.isActive ? (
                <span className="text-muted-foreground mt-2 block text-[10px] uppercase">
                  Nonaktif
                </span>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
