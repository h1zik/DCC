"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  KOL_ALL_ITEMS,
  isKolNavActive,
} from "@/components/kol-hub/kol-hub-module-nav";
import { cn } from "@/lib/utils";

/** Sub-nav horizontal untuk layar kecil (sidebar disembunyikan di mobile). */
export function KolHubSubNav({
  pendingApprovals,
  className,
}: {
  pendingApprovals: number;
  className?: string;
}) {
  const pathname = usePathname() ?? "/kol-hub";

  return (
    <nav
      className={cn(
        "border-border/70 bg-background/70 sticky top-14 z-20 -mt-2 flex gap-2 overflow-x-auto border-b py-2 backdrop-blur-xl",
        className,
      )}
      aria-label="Navigasi modul KOL Hub"
    >
      {KOL_ALL_ITEMS.map((item) => {
        const active = isKolNavActive(item.href, pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_10%,transparent)] text-[var(--lab-accent,var(--primary))] ring-1 ring-[color-mix(in_srgb,var(--lab-accent,var(--primary))_25%,transparent)]"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <item.icon className="size-3.5" aria-hidden />
            {item.label}
            {item.key === "approvals" && pendingApprovals > 0 ? (
              <span className="bg-[var(--lab-accent,var(--primary))] text-primary-foreground rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                {pendingApprovals}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
