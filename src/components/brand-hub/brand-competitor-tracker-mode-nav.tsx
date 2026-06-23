"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Store } from "lucide-react";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/brand-hub/competitor-tracker",
    label: "By Shop",
    icon: Store,
    match: (pathname: string) =>
      pathname.startsWith("/brand-hub/competitor-tracker") &&
      !pathname.startsWith("/brand-hub/competitor-tracker/products"),
  },
  {
    href: "/brand-hub/competitor-tracker/products",
    label: "By Products",
    icon: Package,
    match: (pathname: string) =>
      pathname.startsWith("/brand-hub/competitor-tracker/products"),
  },
] as const;

export function BrandCompetitorTrackerModeNav() {
  const pathname = usePathname();
  const brandId = useBrandHubBrandId();

  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={brandHubHref(tab.href, brandId)}
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
