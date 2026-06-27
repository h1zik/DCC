import {
  Compass,
  ImageIcon,
  Layers,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export type BrandHubNavItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

export type BrandHubNavZone = {
  id: string;
  label: string;
  items: BrandHubNavItem[];
};

export const BRAND_HUB_OVERVIEW: BrandHubNavItem = {
  key: "overview",
  href: "/brand-hub",
  label: "Overview",
  icon: LayoutDashboard,
};

export const BRAND_HUB_ZONES: BrandHubNavZone[] = [
  {
    id: "studio",
    label: "Studio",
    items: [
      { key: "portfolio", href: "/brand-hub/portfolio", label: "Portfolio", icon: Layers },
      { key: "strategy", href: "/brand-hub/strategy", label: "Brand Strategy", icon: Compass },
      { key: "audience", href: "/brand-hub/audience", label: "Audience", icon: Users },
      {
        key: "creative-guideline",
        href: "/brand-hub/creative-guideline",
        label: "Creative Guideline",
        icon: Sparkles,
      },
      {
        key: "visual-library",
        href: "/brand-hub/visual-library",
        label: "Visual Library",
        icon: ImageIcon,
      },
    ],
  },
  {
    id: "intelligence",
    label: "Market Intelligence",
    items: [
      {
        key: "competitor-tracker",
        href: "/brand-hub/competitor-tracker",
        label: "Competitor Tracker",
        icon: Target,
      },
      { key: "ad-library", href: "/brand-hub/ad-library", label: "Ad Library", icon: Megaphone },
      {
        key: "social-listening",
        href: "/brand-hub/social-listening",
        label: "Social Listening",
        icon: MessageSquare,
      },
      {
        key: "visual-trend",
        href: "/brand-hub/visual-trend",
        label: "Visual Trend",
        icon: TrendingUp,
      },
    ],
  },
];

export const BRAND_HUB_ALL_ITEMS: BrandHubNavItem[] = [
  BRAND_HUB_OVERVIEW,
  ...BRAND_HUB_ZONES.flatMap((z) => z.items),
];

export function isBrandHubNavActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/brand-hub") return pathname === "/brand-hub";
  return pathname.startsWith(itemHref);
}

/** Tambahkan query `brandId` (brand scope) ke href bila ada. */
export function hrefWithBrand(href: string, brandId: string | null): string {
  if (!brandId) return href;
  return `${href}?brandId=${encodeURIComponent(brandId)}`;
}
