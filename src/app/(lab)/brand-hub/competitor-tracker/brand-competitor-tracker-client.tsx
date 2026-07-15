"use client";

import Link from "next/link";
import { ResearchMarketplace } from "@prisma/client";
import { ArrowUpRight, Bell, Store, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandCompetitorTrackerModeNav } from "@/components/brand-hub/brand-competitor-tracker-mode-nav";
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
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

      {/* Strip ringkasan portofolio */}
      {competitors.length > 0 ? (
        <div className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}>
          <div className="bento-tile border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
            <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
              Kompetitor dipantau
            </span>
            <span className="bento-value text-white dark:text-pink-950">
              {competitors.length.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-pink-100/90 dark:text-pink-900/80">
              {activeCount} aktif · data dari Research Hub
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Total SKU</span>
            <span className="bento-value">{totalSkus.toLocaleString("id-ID")}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              dari seluruh toko kompetitor
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
            <span className="text-[11.5px] font-semibold text-pink-700/70 dark:text-pink-300/70">
              Visual siap harvest
            </span>
            <span className="bento-value text-pink-900 dark:text-pink-300">
              {totalVisual.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-pink-700/60 dark:text-pink-300/60">
              gambar SKU siap masuk library
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
              harga, SKU baru, dan promo
            </span>
          </div>
        </div>
      ) : null}

      {/* Header daftar */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Kompetitor dipantau</h2>
            <p className={lab.sectionDesc}>
              {competitors.length === 0
                ? "Data kompetitor dikelola Market Analyst di Research Hub."
                : `${competitors.length} toko · ${totalSkus.toLocaleString("id-ID")} SKU dipantau harga, rating, dan promonya.`}
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            Dikelola Market Analyst
          </Badge>
        </div>

        {competitors.length === 0 ? (
          <LabEmptyState
            icon={Target}
            title="Belum ada kompetitor"
            description="Mintakan Market Analyst menambahkan brand kompetitor di Research Hub. Data akan muncul di sini secara otomatis."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {competitors.map((c, index) => (
              <div
                key={c.id}
                className={cn(lab.card, lab.entrance, "group flex flex-col p-0")}
                style={
                  index > 0 && index < 9
                    ? { animationDelay: `${index * 40}ms` }
                    : undefined
                }
              >
                <Link
                  href={brandHubHref(
                    `/brand-hub/competitor-tracker/${c.id}`,
                    brandId,
                  )}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/12 text-base font-extrabold uppercase text-pink-600 dark:text-pink-300"
                        aria-hidden
                      >
                        {c.name.trim().charAt(0) || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{c.name}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {c.brand} · {c.category}
                        </p>
                      </div>
                    </div>
                    <StatusDot active={c.isActive} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <CardStat
                      label="SKU"
                      value={c.skuCount.toLocaleString("id-ID")}
                    />
                    <CardStat
                      label="Visual"
                      value={c.imageSkuCount.toLocaleString("id-ID")}
                    />
                    <CardStat
                      label="Rating"
                      value={c.avgRating != null ? c.avgRating.toFixed(1) : "—"}
                    />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-4 py-2.5">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <Store className="size-3.5" aria-hidden />
                    {MARKETPLACE_LABELS[c.marketplace]}
                  </span>
                  {c.unreadAlerts > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <Bell className="size-3" aria-hidden />
                      {c.unreadAlerts.toLocaleString("id-ID")} alert
                    </span>
                  ) : (
                    <span className="text-muted-foreground/70 text-[11px]">
                      Tanpa alert
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
