"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Palette } from "lucide-react";
import {
  BRAND_HUB_OVERVIEW,
  BRAND_HUB_ZONES,
  hrefWithBrand,
  isBrandHubNavActive,
} from "@/components/brand-hub/brand-hub-module-nav";
import {
  LabSidebarItem,
  lab,
} from "@/components/lab/lab-primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { brandFilterItems } from "@/lib/select-option-items";
import { cn } from "@/lib/utils";

type BrandOption = { id: string; name: string };

/**
 * Sidebar modul Brand & Creative Hub — konsisten dengan Research Hub & SEO
 * Toolkit (reuse `ResearchHubSidebarItem`), ditambah brand scope selector
 * (fitur khas Brand Hub).
 */
export function BrandHubModuleSidebar({
  brands,
  className,
}: {
  brands: BrandOption[];
  className?: string;
}) {
  const pathname = usePathname() ?? "/brand-hub";
  const router = useRouter();
  const searchParams = useSearchParams();
  const brandId = searchParams.get("brandId");

  function handleBrandChange(nextId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextId) params.set("brandId", nextId);
    else params.delete("brandId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const selectedBrand = brands.find((b) => b.id === brandId);
  const brandItems = useMemo(() => brandFilterItems(brands), [brands]);

  return (
    <aside
      className={cn(
        "border-border bg-card/40 sticky top-[4.5rem] z-10 hidden h-[calc(100dvh-5.5rem)] w-56 shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl border p-2 backdrop-blur-xl xl:w-60",
        className,
      )}
      aria-label="Navigasi modul Brand & Creative Hub"
    >
      <div className="flex items-center gap-2.5 px-2 py-1">
        <span className="lab-chip flex size-8 items-center justify-center rounded-lg">
          <Palette className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={lab.label}>Brand & Creative</p>
          <p className="text-foreground truncate text-sm font-semibold">Hub</p>
        </div>
      </div>

      {brands.length > 0 ? (
        <div className="flex flex-col gap-1 px-1">
          <p className={cn(lab.label, "px-2")}>Brand scope</p>
          <Select
            value={brandId ?? "all"}
            items={brandItems}
            onValueChange={(v) => handleBrandChange(v === "all" ? null : v)}
          >
            <SelectTrigger className="h-8 w-full rounded-lg text-xs">
              {selectedBrand?.name ?? "Semua brand"}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua brand</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <nav className="flex flex-col gap-1 px-1">
        <LabSidebarItem
          href={hrefWithBrand(BRAND_HUB_OVERVIEW.href, brandId)}
          title={BRAND_HUB_OVERVIEW.label}
          icon={BRAND_HUB_OVERVIEW.icon}
          active={isBrandHubNavActive(BRAND_HUB_OVERVIEW.href, pathname)}
        />
      </nav>

      {BRAND_HUB_ZONES.map((zone) => (
        <div key={zone.id} className="flex flex-col gap-1 px-1">
          <p className={cn(lab.label, "px-2 pt-2")}>{zone.label}</p>
          {zone.items.map((item) => (
            <LabSidebarItem
              key={item.key}
              href={hrefWithBrand(item.href, brandId)}
              title={item.label}
              icon={item.icon}
              active={isBrandHubNavActive(item.href, pathname)}
            />
          ))}
        </div>
      ))}

      <p className="text-muted-foreground mt-auto px-3 pb-2 text-[10px] leading-relaxed">
        Brand scope di atas memfilter semua modul. Scrape & analisis berjalan di
        background.
      </p>
    </aside>
  );
}
