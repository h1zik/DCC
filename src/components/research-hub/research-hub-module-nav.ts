import {
  BarChart3,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
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
  /** Urutan di alur riset: temukan → pahami pasar → susun strategi. */
  step: number;
  label: string;
  /** Satu kalimat: apa yang dikerjakan di tahap ini. */
  summary: string;
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
    step: 1,
    label: "Temukan peluang",
    summary: "Cari produk dan keyword yang sedang dicari pembeli.",
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
    step: 2,
    label: "Pahami pasar",
    summary: "Baca review, kompetitor, percakapan sosial, dan tren.",
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
        label: "Competitor shops",
        icon: Store,
      },
      {
        key: "competitor-tracker-products",
        href: "/research-hub/competitor-tracker/products",
        label: "Competitor products",
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
    step: 3,
    label: "Susun strategi",
    summary: "Ubah temuan jadi USP, konsep produk, dan laporan.",
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
        key: "product-innovation",
        href: "/research-hub/product-innovation",
        label: "Product Innovation",
        icon: Lightbulb,
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

export type ResearchHubLocation = {
  zone: ResearchHubNavZone | null;
  item: ResearchHubNavItem;
  /** True bila pathname lebih dalam dari halaman indeks modul (halaman detail). */
  isDetail: boolean;
};

/** Modul & tahap alur riset untuk pathname tertentu. */
export function findResearchHubLocation(
  pathname: string,
): ResearchHubLocation | null {
  const path = pathname.replace(/\/$/, "") || "/research-hub";
  if (path === RESEARCH_HUB_OVERVIEW.href) {
    return { zone: null, item: RESEARCH_HUB_OVERVIEW, isDetail: false };
  }
  for (const zone of RESEARCH_HUB_ZONES) {
    for (const item of zone.items) {
      if (isResearchHubNavActive(item.href, path)) {
        return { zone, item, isDetail: path !== item.href };
      }
    }
  }
  return null;
}
