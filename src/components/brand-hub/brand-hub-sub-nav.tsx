"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import {
  Compass,
  ImageIcon,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Palette,
  Sparkles,
  Target,
  TrendingUp,
  Megaphone,
} from "lucide-react";
import { hub } from "@/components/brand-hub/brand-hub-primitives";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SubNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type BrandOption = { id: string; name: string };

type PillGeom = { left: number; width: number; visible: boolean };

const STUDIO_NAV: SubNavItem[] = [
  { href: "/brand-hub", label: "Overview", icon: LayoutDashboard },
  { href: "/brand-hub/portfolio", label: "Portfolio", icon: Layers },
  { href: "/brand-hub/strategy", label: "Strategy", icon: Compass },
  { href: "/brand-hub/creative-guideline", label: "Guideline", icon: Sparkles },
  { href: "/brand-hub/visual-library", label: "Visual", icon: ImageIcon },
];

const INTELLIGENCE_NAV: SubNavItem[] = [
  { href: "/brand-hub/competitor-tracker", label: "Competitor", icon: Target },
  { href: "/brand-hub/ad-library", label: "Ad Library", icon: Megaphone },
  { href: "/brand-hub/social-listening", label: "Social", icon: MessageSquare },
  { href: "/brand-hub/visual-trend", label: "Visual Trend", icon: TrendingUp },
];

const ALL_NAV_ITEMS = [...STUDIO_NAV, ...INTELLIGENCE_NAV];

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
  setRef,
}: {
  item: SubNavItem;
  pathname: string;
  brandId: string | null;
  setRef: (el: HTMLAnchorElement | null) => void;
}) {
  const active = isItemActive(item.href, pathname);
  return (
    <Link
      ref={setRef}
      href={hrefWithBrand(item.href, brandId)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap",
        "transition-[colors,transform] duration-200 ease-out motion-reduce:transition-none",
        "hover:-translate-y-px motion-reduce:hover:translate-y-0",
        active
          ? "text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
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

  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [pill, setPill] = useState<PillGeom>({
    left: 0,
    width: 0,
    visible: false,
  });

  useLayoutEffect(() => {
    const activeItem = ALL_NAV_ITEMS.find((item) =>
      isItemActive(item.href, pathname),
    );
    const node = activeItem
      ? itemRefs.current.get(activeItem.href)
      : undefined;
    const track = trackRef.current;
    if (!node || !track) {
      setPill((prev) => ({ ...prev, visible: false }));
      return;
    }
    const trackRect = track.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    setPill({
      left: nodeRect.left - trackRect.left + track.scrollLeft,
      width: nodeRect.width,
      visible: true,
    });
  }, [pathname]);

  function handleBrandChange(nextId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextId) params.set("brandId", nextId);
    else params.delete("brandId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <nav aria-label="Brand & Creative Hub" className={hub.stickyToolbar}>
      <div className="flex flex-col gap-2 py-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3 overflow-hidden">
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg border border-primary/20">
              <Palette className="size-4" aria-hidden />
            </span>
            <span className="text-xs font-semibold tracking-tight">Brand Hub</span>
          </div>
          <div className="bg-border/60 hidden h-6 w-px sm:block" aria-hidden />

          <div
            ref={trackRef}
            className="relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <span
              aria-hidden
              className={cn(
                "bg-primary/10 ring-primary/20 pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-lg ring-1",
                "transition-[left,width,opacity] duration-300 ease-out motion-reduce:transition-none",
                pill.visible ? "opacity-100" : "opacity-0",
              )}
              style={{ left: pill.left, width: pill.width, height: 30 }}
            />

            {STUDIO_NAV.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                brandId={brandId}
                setRef={(el) => {
                  if (el) itemRefs.current.set(item.href, el);
                }}
              />
            ))}

            <span
              aria-hidden
              className="bg-border/60 mx-0.5 hidden h-4 w-px shrink-0 md:block"
            />

            {INTELLIGENCE_NAV.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                brandId={brandId}
                setRef={(el) => {
                  if (el) itemRefs.current.set(item.href, el);
                }}
              />
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
