"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BRAND_HUB_ALL_ITEMS,
  hrefWithBrand,
  isBrandHubNavActive,
} from "@/components/brand-hub/brand-hub-module-nav";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type BrandOption = { id: string; name: string };

/**
 * Sub-nav horizontal Brand & Creative Hub untuk layar kecil (sidebar modul
 * disembunyikan di mobile) — konsisten dengan Research Hub & SEO Toolkit.
 */
export function BrandHubSubNav({
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
  const selectedBrand = brands.find((b) => b.id === brandId);

  function handleBrandChange(nextId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextId) params.set("brandId", nextId);
    else params.delete("brandId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div
      className={cn(
        "border-border/70 bg-card/80 sticky top-0 z-20 -mt-2 flex items-center gap-2 border-b py-2 backdrop-blur",
        className,
      )}
    >
      <nav
        aria-label="Navigasi modul Brand & Creative Hub"
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {BRAND_HUB_ALL_ITEMS.map((item) => {
          const active = isBrandHubNavActive(item.href, pathname);
          return (
            <Link
              key={item.key}
              href={hrefWithBrand(item.href, brandId)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              <item.icon className="size-3.5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {brands.length > 0 ? (
        <Select
          value={brandId ?? "all"}
          onValueChange={(v) => handleBrandChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="h-8 w-[130px] shrink-0 rounded-lg text-xs">
            {selectedBrand?.name ?? "Semua"}
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
      ) : null}
    </div>
  );
}
