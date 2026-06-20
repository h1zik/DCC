"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import {
  RESEARCH_HUB_OVERVIEW,
  RESEARCH_HUB_ZONES,
  isResearchHubNavActive,
} from "@/components/research-hub/research-hub-module-nav";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

type PillGeom = { left: number; width: number; visible: boolean };

const MOBILE_NAV_ITEMS = [
  RESEARCH_HUB_OVERVIEW,
  ...RESEARCH_HUB_ZONES.flatMap((z) => z.items),
];

export function ResearchHubSubNav({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/research-hub";
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [pill, setPill] = useState<PillGeom>({
    left: 0,
    width: 0,
    visible: false,
  });

  useLayoutEffect(() => {
    const activeItem = MOBILE_NAV_ITEMS.find((item) =>
      isResearchHubNavActive(item.href, pathname),
    );
    const node = activeItem
      ? itemRefs.current.get(activeItem.href)
      : undefined;
    const track = trackRef.current;
    if (!node || !track) {
      setPill((prev) => ({ ...prev, visible: false }));
      return;
    }
    const trackRect = track.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    setPill({
      left: nodeRect.left - trackRect.left + track.scrollLeft,
      width: nodeRect.width,
      visible: true,
    });
  }, [pathname]);

  return (
    <nav
      aria-label="Modul Research Hub"
      className={cn(hub.stickyToolbar, className)}
    >
      <div
        ref={trackRef}
        className="relative flex w-full items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <span
          aria-hidden
          className={cn(
            "bg-primary/10 ring-primary/20 pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-lg ring-1",
            "transition-[left,width,opacity] duration-300 ease-out motion-reduce:transition-none",
            pill.visible ? "opacity-100" : "opacity-0",
          )}
          style={{ left: pill.left, width: pill.width, height: 30 }}
        />

        <Link
          ref={(el) => {
            if (el) itemRefs.current.set(RESEARCH_HUB_OVERVIEW.href, el);
          }}
          href={RESEARCH_HUB_OVERVIEW.href}
          aria-current={
            isResearchHubNavActive(RESEARCH_HUB_OVERVIEW.href, pathname)
              ? "page"
              : undefined
          }
          className={cn(
            "relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap",
            "transition-[colors,transform] duration-200 ease-out motion-reduce:transition-none",
            "hover:-translate-y-px motion-reduce:hover:translate-y-0",
            isResearchHubNavActive(RESEARCH_HUB_OVERVIEW.href, pathname)
              ? "text-primary"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <RESEARCH_HUB_OVERVIEW.icon className="size-3.5 shrink-0" aria-hidden />
          {RESEARCH_HUB_OVERVIEW.label}
        </Link>

        {RESEARCH_HUB_ZONES.map((zone) => (
          <span key={zone.id} className="contents">
            <span
              aria-hidden
              className="bg-border/60 mx-0.5 hidden h-4 w-px shrink-0 sm:block"
            />
            {zone.items.map((item) => {
              const active = isResearchHubNavActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  ref={(el) => {
                    if (el) itemRefs.current.set(item.href, el);
                  }}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap",
                    "transition-[colors,transform] duration-200 ease-out motion-reduce:transition-none",
                    "hover:-translate-y-px motion-reduce:hover:translate-y-0",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="size-3.5 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </span>
        ))}
      </div>
    </nav>
  );
}
