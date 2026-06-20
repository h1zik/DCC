"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Microscope } from "lucide-react";
import {
  RESEARCH_HUB_OVERVIEW,
  RESEARCH_HUB_ZONES,
  isResearchHubNavActive,
} from "@/components/research-hub/research-hub-module-nav";
import {
  ResearchHubSidebarItem,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

export function ResearchHubModuleSidebar({
  className,
}: {
  className?: string;
}) {
  const pathname = usePathname() ?? "/research-hub";

  return (
    <aside
      className={cn(
        "sticky top-0 z-10 hidden h-[calc(100dvh-4rem)] w-56 shrink-0 flex-col gap-4 overflow-y-auto py-1 xl:w-60",
        className,
      )}
      aria-label="Navigasi modul Research Hub"
    >
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg border border-primary/25">
          <Microscope className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={hub.label}>Research</p>
          <p className="text-foreground truncate text-sm font-semibold">
            Hub
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-1">
        <ResearchHubSidebarItem
          href={RESEARCH_HUB_OVERVIEW.href}
          title={RESEARCH_HUB_OVERVIEW.label}
          icon={RESEARCH_HUB_OVERVIEW.icon}
          active={isResearchHubNavActive(
            RESEARCH_HUB_OVERVIEW.href,
            pathname,
          )}
        />
      </nav>

      {RESEARCH_HUB_ZONES.map((zone) => (
        <div key={zone.id} className="flex flex-col gap-1 px-1">
          <p className={cn(hub.label, "px-2 pt-2")}>{zone.label}</p>
          {zone.items.map((item) => (
            <ResearchHubSidebarItem
              key={item.key}
              href={item.href}
              title={item.label}
              icon={item.icon}
              active={isResearchHubNavActive(item.href, pathname)}
            />
          ))}
        </div>
      ))}

      <p className="text-muted-foreground mt-auto px-3 pb-2 text-[10px] leading-relaxed">
        Scrape & analisis berjalan di background — kamu bebas navigasi antar
        modul.
      </p>
    </aside>
  );
}
