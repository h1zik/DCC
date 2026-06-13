"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  FlaskConical,
  LayoutDashboard,
  MessageSquare,
  PackageSearch,
  Radar,
  Search,
  Star,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SubNavItem = {
  href?: string;
  label: string;
  icon: typeof LayoutDashboard;
  comingSoon?: boolean;
};

const NAV_ITEMS: SubNavItem[] = [
  { href: "/research-hub", label: "Ringkasan", icon: LayoutDashboard },
  {
    href: "/research-hub/product-discovery",
    label: "Product Discovery",
    icon: PackageSearch,
  },
  {
    href: "/research-hub/review-intelligence",
    label: "Review Intelligence",
    icon: Star,
  },
  {
    href: "/research-hub/competitor-tracker",
    label: "Competitor Tracker",
    icon: Target,
  },
  {
    href: "/research-hub/trend-radar",
    label: "Trend Radar",
    icon: Radar,
  },
  {
    href: "/research-hub/keyword-intel",
    label: "Keyword Intel",
    icon: Search,
  },
  {
    href: "/research-hub/social-listening",
    label: "Social Listening",
    icon: MessageSquare,
  },
  {
    href: "/research-hub/usp-analyzer",
    label: "USP Analyzer",
    icon: BarChart3,
  },
  {
    href: "/research-hub/concept-lab",
    label: "Concept Lab",
    icon: FlaskConical,
  },
  {
    href: "/research-hub/research-reports",
    label: "Research Reports",
    icon: FileText,
  },
];

function isItemActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/research-hub") return pathname === "/research-hub";
  return pathname.startsWith(itemHref);
}

export function ResearchHubSubNav() {
  const pathname = usePathname() ?? "/research-hub";

  return (
    <nav
      aria-label="Modul Research Hub"
      className="border-border/70 bg-card/80 sticky top-0 z-20 -mt-2 border-b backdrop-blur supports-backdrop-filter:bg-card/60"
    >
      <div className="flex w-full items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map((item) => {
          if (item.comingSoon || !item.href) {
            return (
              <span
                key={item.label}
                className="text-muted-foreground/60 inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap"
                title="Segera hadir"
              >
                <item.icon className="size-3.5 shrink-0 opacity-50" aria-hidden />
                {item.label}
                <span className="bg-muted text-muted-foreground rounded px-1 py-px text-[9px] font-semibold uppercase">
                  Segera
                </span>
              </span>
            );
          }

          const active = isItemActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
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
    </nav>
  );
}
