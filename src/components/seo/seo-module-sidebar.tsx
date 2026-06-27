"use client";

import { usePathname } from "next/navigation";
import { Gauge } from "lucide-react";
import {
  SEO_OVERVIEW,
  SEO_ZONES,
  isSeoNavActive,
} from "@/components/seo/seo-module-nav";
import {
  ResearchHubSidebarItem,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

/** Sidebar modul SEO Toolkit (reuse primitive Research Hub agar konsisten). */
export function SeoModuleSidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/seo";

  return (
    <aside
      className={cn(
        "sticky top-0 z-10 hidden h-[calc(100dvh-4rem)] w-56 shrink-0 flex-col gap-4 overflow-y-auto py-1 xl:w-60",
        className,
      )}
      aria-label="Navigasi modul SEO Toolkit"
    >
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg border border-primary/25">
          <Gauge className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={hub.label}>SEO</p>
          <p className="text-foreground truncate text-sm font-semibold">
            Toolkit
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-1">
        <ResearchHubSidebarItem
          href={SEO_OVERVIEW.href}
          title={SEO_OVERVIEW.label}
          icon={SEO_OVERVIEW.icon}
          active={isSeoNavActive(SEO_OVERVIEW.href, pathname)}
        />
      </nav>

      {SEO_ZONES.map((zone) => (
        <div key={zone.id} className="flex flex-col gap-1 px-1">
          <p className={cn(hub.label, "px-2 pt-2")}>{zone.label}</p>
          {zone.items.map((item) => (
            <ResearchHubSidebarItem
              key={item.key}
              href={item.href}
              title={item.label}
              icon={item.icon}
              active={isSeoNavActive(item.href, pathname)}
            />
          ))}
        </div>
      ))}

      <p className="text-muted-foreground mt-auto px-3 pb-2 text-[10px] leading-relaxed">
        Riset & rank tracking memakai DataForSEO (lokasi Indonesia). Hasil
        di-cache untuk menghemat biaya.
      </p>
    </aside>
  );
}
