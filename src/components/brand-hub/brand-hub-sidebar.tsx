"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Compass,
  ImageIcon,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Palette,
  Radar,
  Search,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { hub } from "@/components/brand-hub/brand-hub-primitives";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  shortLabel?: string;
};

type BrandOption = { id: string; name: string };

const STUDIO_NAV: NavItem[] = [
  { href: "/brand-hub", label: "Overview", icon: LayoutDashboard, shortLabel: "Home" },
  { href: "/brand-hub/strategy", label: "Brand Strategy", icon: Compass },
  {
    href: "/brand-hub/creative-guideline",
    label: "Creative Guideline",
    icon: Sparkles,
    shortLabel: "Guideline",
  },
  {
    href: "/brand-hub/visual-library",
    label: "Visual Library",
    icon: ImageIcon,
    shortLabel: "Visuals",
  },
];

const INTELLIGENCE_NAV: NavItem[] = [
  {
    href: "/brand-hub/competitor-tracker",
    label: "Competitor Tracker",
    icon: Target,
    shortLabel: "Competitor",
  },
  {
    href: "/brand-hub/review-intelligence",
    label: "Review Intel",
    icon: Star,
  },
  { href: "/brand-hub/trend-radar", label: "Trend Radar", icon: Radar },
  { href: "/brand-hub/keyword-intel", label: "Keyword Intel", icon: Search },
  {
    href: "/brand-hub/social-listening",
    label: "Social Listening",
    icon: MessageSquare,
    shortLabel: "Social",
  },
  { href: "/brand-hub/usp-analyzer", label: "USP Analyzer", icon: BarChart3 },
];

function isActive(href: string, pathname: string) {
  if (href === "/brand-hub") return pathname === "/brand-hub";
  return pathname.startsWith(href);
}

function hrefWithBrand(href: string, brandId: string | null) {
  if (!brandId) return href;
  return `${href}?brandId=${encodeURIComponent(brandId)}`;
}

function NavSection({
  title,
  items,
  pathname,
  brandId,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  brandId: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className={cn(hub.label, "mb-1 px-3")}>{title}</p>
      {items.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={hrefWithBrand(item.href, brandId)}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
              "transition-[color,background-color,transform] duration-200 ease-out motion-reduce:transition-none",
              "hover:-translate-y-px motion-reduce:hover:translate-y-0",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function BrandSelector({
  brands,
  brandId,
  onChange,
  className,
}: {
  brands: BrandOption[];
  brandId: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  if (brands.length === 0) return null;
  const selected = brands.find((b) => b.id === brandId);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className={cn(hub.label, "px-0.5")}>Brand scope</p>
      <Select
        value={brandId ?? "all"}
        onValueChange={(v) => onChange(v === "all" ? null : v)}
      >
        <SelectTrigger className="h-9 w-full rounded-xl text-xs">
          <SelectValue placeholder="Semua brand">
            {selected?.name ?? "Semua brand"}
          </SelectValue>
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
  );
}

function SidebarContent({
  brands,
  pathname,
  brandId,
  onBrandChange,
  onNavigate,
}: {
  brands: BrandOption[];
  pathname: string;
  brandId: string | null;
  onBrandChange: (id: string | null) => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center gap-3 px-1">
        <span className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-2xl border border-primary/20">
          <Palette className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Brand & Creative</p>
          <p className="text-muted-foreground text-[11px]">Strategy workspace</p>
        </div>
      </div>

      <BrandSelector brands={brands} brandId={brandId} onChange={onBrandChange} />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-1">
        <NavSection
          title="Studio"
          items={STUDIO_NAV}
          pathname={pathname}
          brandId={brandId}
          onNavigate={onNavigate}
        />
        <NavSection
          title="Market Intelligence"
          items={INTELLIGENCE_NAV}
          pathname={pathname}
          brandId={brandId}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

export function BrandHubSidebar({ brands }: { brands: BrandOption[] }) {
  const pathname = usePathname() ?? "/brand-hub";
  const router = useRouter();
  const searchParams = useSearchParams();
  const brandId = searchParams.get("brandId");
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleBrandChange(nextId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextId) params.set("brandId", nextId);
    else params.delete("brandId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const activeItem =
    [...STUDIO_NAV, ...INTELLIGENCE_NAV].find((i) => isActive(i.href, pathname)) ??
    STUDIO_NAV[0]!;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        aria-label="Brand & Creative Hub navigation"
        className="border-border/50 bg-card/40 hidden w-60 shrink-0 flex-col border-r px-4 py-6 lg:flex xl:w-64"
      >
        <SidebarContent
          brands={brands}
          pathname={pathname}
          brandId={brandId}
          onBrandChange={handleBrandChange}
        />
      </aside>

      {/* Mobile top bar */}
      <div className={cn(hub.stickyToolbar, "flex items-center gap-2 px-1 py-2 lg:hidden")}>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="size-4" />
          Menu
        </Button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[min(100vw-2rem,320px)] p-0">
            <SheetHeader className="border-border/50 border-b p-4 text-left">
              <SheetTitle className="flex items-center justify-between text-base">
                Brand & Creative
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Tutup menu"
                >
                  <X className="size-4" />
                </Button>
              </SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <SidebarContent
                brands={brands}
                pathname={pathname}
                brandId={brandId}
                onBrandChange={handleBrandChange}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{activeItem.label}</p>
          <p className="text-muted-foreground truncate text-[11px]">
            {brands.find((b) => b.id === brandId)?.name ?? "Semua brand"}
          </p>
        </div>

        {brands.length > 0 ? (
          <Select
            value={brandId ?? "all"}
            onValueChange={(v) => handleBrandChange(v === "all" ? null : v)}
          >
            <SelectTrigger className="h-9 w-[130px] shrink-0 rounded-xl text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </>
  );
}
