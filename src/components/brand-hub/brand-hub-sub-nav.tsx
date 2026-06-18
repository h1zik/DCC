"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  MessageSquare,
  Radar,
  Search,
  Star,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type SubNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type BrandOption = { id: string; name: string };

const NAV_ITEMS: SubNavItem[] = [
  { href: "/brand-hub", label: "Overview", icon: LayoutDashboard },
  {
    href: "/brand-hub/competitor-tracker",
    label: "Competitor Tracker",
    icon: Target,
  },
  {
    href: "/brand-hub/review-intelligence",
    label: "Review Intel",
    icon: Star,
  },
  {
    href: "/brand-hub/trend-radar",
    label: "Trend Radar",
    icon: Radar,
  },
  {
    href: "/brand-hub/keyword-intel",
    label: "Keyword Intel",
    icon: Search,
  },
  {
    href: "/brand-hub/social-listening",
    label: "Social Listening",
    icon: MessageSquare,
  },
  {
    href: "/brand-hub/usp-analyzer",
    label: "USP Analyzer",
    icon: BarChart3,
  },
];

function isItemActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/brand-hub") return pathname === "/brand-hub";
  return pathname.startsWith(itemHref);
}

function hrefWithBrand(href: string, brandId: string | null): string {
  if (!brandId) return href;
  return `${href}?brandId=${encodeURIComponent(brandId)}`;
}

export function BrandHubSubNav({ brands }: { brands: BrandOption[] }) {
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
    <nav
      aria-label="Modul Brand & Creative Hub"
      className="border-border/70 bg-card/80 sticky top-0 z-20 -mt-2 border-b backdrop-blur supports-backdrop-filter:bg-card/60"
    >
      <div className="flex w-full flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={hrefWithBrand(item.href, brandId)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-3.5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
        {brands.length > 0 ? (
          <div className="flex shrink-0 items-center gap-2 px-1">
            <span className="text-muted-foreground hidden text-[10px] font-medium uppercase tracking-wide sm:inline">
              Brand
            </span>
            <Select
              value={brandId ?? "all"}
              onValueChange={(v) => handleBrandChange(v === "all" ? null : v)}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
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
      </div>
    </nav>
  );
}
