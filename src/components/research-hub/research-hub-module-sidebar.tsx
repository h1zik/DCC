"use client";

import { usePathname } from "next/navigation";
import { Microscope } from "lucide-react";
import {
  RESEARCH_HUB_OVERVIEW,
  RESEARCH_HUB_ZONES,
  isResearchHubNavActive,
} from "@/components/research-hub/research-hub-module-nav";
import {
  LabSidebarItem,
  lab,
} from "@/components/lab/lab-primitives";
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
        "border-border bg-card/40 sticky top-[4.5rem] z-10 hidden h-[calc(100dvh-5.5rem)] w-56 shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl border p-2 backdrop-blur-xl xl:w-60",
        className,
      )}
      aria-label="Navigasi modul Research Hub"
    >
      <div className="flex items-center gap-2.5 px-2 py-1">
        <span className="lab-chip flex size-8 items-center justify-center rounded-lg">
          <Microscope className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={lab.label}>Research</p>
          <p className="text-foreground truncate text-sm font-semibold">
            Hub
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-1">
        <LabSidebarItem
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
          <p className={cn(lab.label, "px-2 pt-2")}>{zone.label}</p>
          {zone.items.map((item) => (
            <LabSidebarItem
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
