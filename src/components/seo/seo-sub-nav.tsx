"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SEO_ALL_ITEMS, isSeoNavActive } from "@/components/seo/seo-module-nav";
import { cn } from "@/lib/utils";

/** Sub-nav horizontal untuk layar kecil (sidebar disembunyikan di mobile). */
export function SeoSubNav({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/seo";

  return (
    <nav
      className={cn(
        "border-border/70 bg-card/80 sticky top-0 z-20 -mt-2 flex gap-2 overflow-x-auto border-b py-2 backdrop-blur",
        className,
      )}
      aria-label="Navigasi modul SEO Toolkit"
    >
      {SEO_ALL_ITEMS.map((item) => {
        const active = isSeoNavActive(item.href, pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <item.icon className="size-3.5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
