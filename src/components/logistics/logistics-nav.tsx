"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Truck, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/inventory", label: "Inventori", icon: Warehouse },
  { href: "/products", label: "Produk & SKU", icon: Package },
  { href: "/vendors", label: "Vendor Maklon", icon: Truck },
] as const;

export function LogisticsNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
      aria-label="Navigasi logistik"
    >
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
