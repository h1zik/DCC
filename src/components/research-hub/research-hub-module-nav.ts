import {
  BarChart3,
  FileText,
  FlaskConical,
  LayoutDashboard,
  MessageSquare,
  Package,
  PackageSearch,
  Radar,
  Search,
  Star,
  Store,
  type LucideIcon,
} from "lucide-react";

export type ResearchHubNavItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

export type ResearchHubNavZone = {
  id: string;
  label: string;
  items: ResearchHubNavItem[];
};

export const RESEARCH_HUB_OVERVIEW: ResearchHubNavItem = {
  key: "overview",
  href: "/research-hub",
  label: "Overview",
  icon: LayoutDashboard,
};

export const RESEARCH_HUB_ZONES: ResearchHubNavZone[] = [
  {
    id: "discover",
    label: "Discover",
    items: [
      {
        key: "product-discovery",
        href: "/research-hub/product-discovery",
        label: "Product Discovery",
        icon: PackageSearch,
      },
      {
        key: "keyword-intel",
        href: "/research-hub/keyword-intel",
        label: "Keyword Intel",
        icon: Search,
      },
    ],
  },
  {
    id: "intelligence",
    label: "Market Intelligence",
    items: [
      {
        key: "review-intelligence",
        href: "/research-hub/review-intelligence",
        label: "Review Intelligence",
        icon: Star,
      },
      {
        key: "competitor-tracker-shops",
        href: "/research-hub/competitor-tracker",
        label: "Competitor — Shops",
        icon: Store,
      },
      {
        key: "competitor-tracker-products",
        href: "/research-hub/competitor-tracker/products",
        label: "Competitor — Products",
        icon: Package,
      },
      {
        key: "social-listening",
        href: "/research-hub/social-listening",
        label: "Social Listening",
        icon: MessageSquare,
      },
      {
        key: "trend-radar",
        href: "/research-hub/trend-radar",
        label: "Trend Radar",
        icon: Radar,
      },
    ],
  },
  {
    id: "strategy",
    label: "Strategy & Output",
    items: [
      {
        key: "usp-analyzer",
        href: "/research-hub/usp-analyzer",
        label: "USP Analyzer",
        icon: BarChart3,
      },
      {
        key: "concept-lab",
        href: "/research-hub/concept-lab",
        label: "Concept Lab",
        icon: FlaskConical,
      },
      {
        key: "research-reports",
        href: "/research-hub/research-reports",
        label: "Research Reports",
        icon: FileText,
      },
    ],
  },
];

export const RESEARCH_HUB_ALL_ITEMS: ResearchHubNavItem[] = [
  RESEARCH_HUB_OVERVIEW,
  ...RESEARCH_HUB_ZONES.flatMap((z) => z.items),
];

export function isResearchHubNavActive(
  itemHref: string,
  pathname: string,
): boolean {
  if (itemHref === "/research-hub") return pathname === "/research-hub";
  // Competitor Tracker: Shops vs Products saling eksklusif agar tidak highlight bareng.
  if (
    itemHref === "/research-hub/competitor-tracker" &&
    pathname.startsWith("/research-hub/competitor-tracker/products")
  ) {
    return false;
  }
  return pathname.startsWith(itemHref);
}
