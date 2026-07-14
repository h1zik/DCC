"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  CONTENT_STUDIO_OVERVIEW,
  CONTENT_STUDIO_ZONES,
  hrefWithBrand,
  isContentStudioNavActive,
} from "@/components/content-studio/content-studio-module-nav";
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
 * Sidebar Content & Creator Studio — konsisten dengan Research/SEO/Brand Hub
 * (reuse `LabSidebarItem`) + brand scope selector (grounding ide
 * mengikuti brand yang dipilih).
 */
export function ContentStudioSidebar({
  brands,
  className,
}: {
  brands: BrandOption[];
  className?: string;
}) {
  const pathname = usePathname() ?? "/content-studio";
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
      aria-label="Navigasi Content & Creator Studio"
    >
      <div className="flex items-center gap-2.5 px-2 py-1">
        <span className="lab-chip flex size-8 items-center justify-center rounded-lg">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={lab.label}>Content & Creator</p>
          <p className="text-foreground truncate text-sm font-semibold">Studio</p>
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
          href={hrefWithBrand(CONTENT_STUDIO_OVERVIEW.href, brandId)}
          title={CONTENT_STUDIO_OVERVIEW.label}
          icon={CONTENT_STUDIO_OVERVIEW.icon}
          active={isContentStudioNavActive(CONTENT_STUDIO_OVERVIEW.href, pathname)}
        />
      </nav>

      {CONTENT_STUDIO_ZONES.map((zone) => (
        <div key={zone.id} className="flex flex-col gap-1 px-1">
          <p className={cn(lab.label, "px-2 pt-2")}>{zone.label}</p>
          {zone.items.map((item) => (
            <LabSidebarItem
              key={item.key}
              href={hrefWithBrand(item.href, brandId)}
              title={item.label}
              icon={item.icon}
              active={isContentStudioNavActive(item.href, pathname)}
            />
          ))}
        </div>
      ))}

      <p className="text-muted-foreground mt-auto px-3 pb-2 text-[10px] leading-relaxed">
        Brand scope menentukan data grounding (Review Intel, Ad Library, Trend
        Radar) yang menyuntik ide. Generate berjalan di background.
      </p>
    </aside>
  );
}
