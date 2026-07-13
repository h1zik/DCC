import {
  Activity,
  Bot,
  Bug,
  FileText,
  Globe,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  ListChecks,
  PenLine,
  Search,
  Store,
  Swords,
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
      {
        key: "domain-overview",
        href: "/seo/domain-overview",
        label: "Domain Overview",
        icon: Globe,
      },
      {
        key: "keyword-gap",
        href: "/seo/keyword-gap",
        label: "Keyword Gap",
        icon: Swords,
      },
      {
        key: "ai-visibility",
        href: "/seo/ai-visibility",
        label: "AI Visibility",
        icon: Bot,
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
        key: "opportunities",
        href: "/seo/content/opportunities",
        label: "Opportunities",
        icon: Lightbulb,
      },
      {
        key: "content",
        href: "/seo/content",
        label: "Content Optimizer",
        icon: PenLine,
      },
      {
        key: "content-audit",
        href: "/seo/content-audit",
        label: "Content Audit",
        icon: Activity,
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
  if (!pathname.startsWith(itemHref)) return false;
  // Item lain yang prefix-nya lebih spesifik menang (mis. /seo/content vs
  // /seo/content/opportunities) agar tidak dua item aktif sekaligus.
  return !SEO_ALL_ITEMS.some(
    (item) =>
      item.href !== itemHref &&
      item.href.startsWith(itemHref) &&
      pathname.startsWith(item.href),
  );
}
