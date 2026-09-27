"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Megaphone } from "lucide-react";
import {
  KOL_OVERVIEW,
  KOL_ZONES,
  isKolNavActive,
} from "@/components/kol-hub/kol-hub-module-nav";
import { LabSidebarItem, lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

function CountBadge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span
      className="bg-[var(--lab-accent,var(--primary))] text-primary-foreground min-w-5 rounded-full px-1.5 py-px text-center text-[10px] font-semibold tabular-nums"
      aria-label={`${value} menunggu`}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

/** Sidebar modul KOL Hub (primitive Dominatus Lab). */
export function KolHubModuleSidebar({
  pendingApprovals,
  showBrandHubLinks,
  className,
}: {
  pendingApprovals: number;
  showBrandHubLinks: boolean;
  className?: string;
}) {
  const pathname = usePathname() ?? "/kol-hub";

  return (
    <aside
      className={cn(
        "border-border bg-card/40 sticky top-[4.5rem] z-10 hidden h-[calc(100dvh-5.5rem)] w-56 shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl border p-2 backdrop-blur-xl xl:w-60",
        className,
      )}
      aria-label="Navigasi modul KOL Hub"
    >
      <div className="flex items-center gap-2.5 px-2 py-1">
        <span className="lab-chip flex size-8 items-center justify-center rounded-lg">
          <Megaphone className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={lab.label}>KOL</p>
          <p className="text-foreground truncate text-sm font-semibold">Hub</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-1">
        <LabSidebarItem
          href={KOL_OVERVIEW.href}
          title={KOL_OVERVIEW.label}
          icon={KOL_OVERVIEW.icon}
          active={isKolNavActive(KOL_OVERVIEW.href, pathname)}
        />
      </nav>

      {KOL_ZONES.map((zone) => (
        <div key={zone.id} className="flex flex-col gap-1 px-1">
          <p className="text-muted-foreground px-2 pt-2 text-[11px] font-medium">
            {zone.label}
          </p>
          {zone.items.map((item) => (
            <LabSidebarItem
              key={item.key}
              href={item.href}
              title={item.label}
              icon={item.icon}
              active={isKolNavActive(item.href, pathname)}
              badge={
                item.key === "approvals" ? (
                  <CountBadge value={pendingApprovals} />
                ) : undefined
              }
            />
          ))}
        </div>
      ))}

      {showBrandHubLinks ? (
        <div className="mt-auto flex flex-col gap-1 px-1 pb-1">
          <p className="text-muted-foreground px-2 text-[11px] font-medium">
            Cari & periksa KOL di Brand Hub
          </p>
          {[
            { href: "/brand-hub/kol-radar", label: "KOL Radar" },
            { href: "/brand-hub/influencer-audit", label: "Audit influencer" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground hover:bg-muted/80 hover:text-foreground flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors"
            >
              {l.label}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
