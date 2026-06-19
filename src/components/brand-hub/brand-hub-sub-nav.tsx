"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Compass,
  ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Palette,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hub } from "@/components/brand-hub/brand-hub-primitives";

type SubNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type BrandOption = { id: string; name: string };

const STUDIO_NAV: SubNavItem[] = [
  { href: "/brand-hub", label: "Overview", icon: LayoutDashboard },
  { href: "/brand-hub/strategy", label: "Strategy", icon: Compass },
  { href: "/brand-hub/creative-guideline", label: "Guideline", icon: Sparkles },
  { href: "/brand-hub/visual-library", label: "Visual", icon: ImageIcon },
];

const INTELLIGENCE_NAV: SubNavItem[] = [
  { href: "/brand-hub/competitor-tracker", label: "Competitor", icon: Target },
  { href: "/brand-hub/social-listening", label: "Social", icon: MessageSquare },
  { href: "/brand-hub/visual-trend", label: "Visual Trend", icon: TrendingUp },
];

function isItemActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/brand-hub") return pathname === "/brand-hub";
  return pathname.startsWith(itemHref);
}

function hrefWithBrand(href: string, brandId: string | null): string {
  if (!brandId) return href;
  return `${href}?brandId=${encodeURIComponent(brandId)}`;
}

function NavLink({
  item,
  pathname,
  brandId,
}: {
  item: SubNavItem;
  pathname: string;
  brandId: string | null;
}) {
  const active = isItemActive(item.href, pathname);
  return (
    <Link
      href={hrefWithBrand(item.href, brandId)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <item.icon className="size-3.5 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
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
      aria-label="Brand & Creative Hub"
      className={cn(hub.stickyToolbar, "-mx-1 rounded-xl border px-2 py-2")}
    >
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg border border-primary/20">
              <Palette className="size-4" aria-hidden />
            </span>
            <span className="text-xs font-semibold tracking-tight">Brand Hub</span>
          </div>
          <div className="bg-border/60 hidden h-6 w-px sm:block" aria-hidden />
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STUDIO_NAV.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} brandId={brandId} />
            ))}
          </div>
          <div className="bg-border/60 mx-1 hidden h-6 w-px md:block" aria-hidden />
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {INTELLIGENCE_NAV.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} brandId={brandId} />
            ))}
          </div>
        </div>

        {brands.length > 0 ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn(hub.label, "hidden sm:inline")}>Brand</span>
            <Select
              value={brandId ?? "all"}
              onValueChange={(v) => handleBrandChange(v === "all" ? null : v)}
            >
              <SelectTrigger className="h-8 w-full min-w-[140px] rounded-lg text-xs sm:w-[168px]">
                <SelectValue>{selectedBrand?.name ?? "Semua brand"}</SelectValue>
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
