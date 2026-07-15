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

/** Segmented control mode tracker — pill tinta solid untuk tab aktif. */
export function BrandCompetitorTrackerModeNav() {
  const pathname = usePathname();
  const brandId = useBrandHubBrandId();

  return (
    <div className="bg-muted/60 inline-flex w-fit flex-wrap items-center gap-1 rounded-full p-1">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={brandHubHref(tab.href, brandId)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none",
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
