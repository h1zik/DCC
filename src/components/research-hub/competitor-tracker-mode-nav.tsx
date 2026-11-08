"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/research-hub/competitor-tracker",
    label: "Toko",
    icon: Store,
    match: (pathname: string) =>
      pathname.startsWith("/research-hub/competitor-tracker") &&
      !pathname.startsWith("/research-hub/competitor-tracker/products"),
  },
  {
    href: "/research-hub/competitor-tracker/products",
    label: "Produk",
    icon: Package,
    match: (pathname: string) =>
      pathname.startsWith("/research-hub/competitor-tracker/products"),
  },
] as const;

/**
 * Sakelar Toko/Produk Competitor Tracker — segmented control tenang.
 * Di desktop sidebar modul sudah memuat kedua entri, jadi pemanggil biasanya
 * menyembunyikannya di `lg` (`className="lg:hidden"`); di mobile sakelar ini
 * menegaskan bahwa kedua halaman adalah dua sisi satu tracker.
 */
export function CompetitorTrackerModeNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Tampilan Competitor Tracker" className={className}>
      <div className="bg-muted/60 inline-flex items-center rounded-lg p-0.5">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
