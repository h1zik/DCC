"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/research-hub/competitor-tracker",
    label: "By Shop",
    icon: Store,
    match: (pathname: string) =>
      pathname.startsWith("/research-hub/competitor-tracker") &&
      !pathname.startsWith("/research-hub/competitor-tracker/products"),
  },
  {
    href: "/research-hub/competitor-tracker/products",
    label: "By Products",
    icon: Package,
    match: (pathname: string) =>
      pathname.startsWith("/research-hub/competitor-tracker/products"),
  },
] as const;

export function CompetitorTrackerModeNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
