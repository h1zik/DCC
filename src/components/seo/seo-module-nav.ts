import {
  Bug,
  FileText,
  LayoutDashboard,
  LineChart,
  ListChecks,
  PenLine,
  Search,
  Store,
  type LucideIcon,
} from "lucide-react";

export type SeoNavItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

export type SeoNavZone = {
  id: string;
  label: string;
  items: SeoNavItem[];
};

export const SEO_OVERVIEW: SeoNavItem = {
  key: "overview",
  href: "/seo",
  label: "Overview",
  icon: LayoutDashboard,
};

export const SEO_ZONES: SeoNavZone[] = [
  {
    id: "research",
    label: "Riset & Tracking",
    items: [
      {
        key: "keyword-research",
        href: "/seo/keyword-research",
        label: "Keyword Research",
        icon: Search,
      },
      {
        key: "rank-tracker",
        href: "/seo/rank-tracker",
        label: "Rank Tracker",
        icon: LineChart,
      },
    ],
  },
  {
    id: "audit",
    label: "Audit Teknis",
    items: [
      {
        key: "onpage-audit",
        href: "/seo/onpage-audit",
        label: "On-Page Audit",
        icon: ListChecks,
      },
      {
        key: "crawler",
        href: "/seo/crawler",
        label: "Technical Crawler",
        icon: Bug,
      },
    ],
  },
  {
    id: "content",
    label: "Konten",
    items: [
      {
        key: "content",
        href: "/seo/content",
        label: "Content Optimizer",
        icon: PenLine,
      },
    ],
  },
  {
    id: "marketplace-reports",
    label: "Marketplace & Laporan",
    items: [
      {
        key: "marketplace",
        href: "/seo/marketplace",
        label: "Marketplace SEO",
        icon: Store,
      },
      {
        key: "reports",
        href: "/seo/reports",
        label: "SEO Reports",
        icon: FileText,
      },
    ],
  },
];

export const SEO_ALL_ITEMS: SeoNavItem[] = [
  SEO_OVERVIEW,
  ...SEO_ZONES.flatMap((z) => z.items),
];

export function isSeoNavActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/seo") return pathname === "/seo";
  return pathname.startsWith(itemHref);
}
