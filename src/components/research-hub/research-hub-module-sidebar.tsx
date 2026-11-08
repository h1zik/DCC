"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  RESEARCH_HUB_OVERVIEW,
  RESEARCH_HUB_ZONES,
  isResearchHubNavActive,
  type ResearchHubNavItem,
} from "@/components/research-hub/research-hub-module-nav";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rh-sidebar-collapsed";

const CHANGE_EVENT = "rh-sidebar-change";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function writeCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* storage diblokir — pilihan tidak diingat */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: ResearchHubNavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "focus-visible:ring-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors focus-visible:ring-2 focus-visible:outline-none",
        collapsed && "justify-center px-0",
        active
          ? "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_11%,transparent)] text-foreground font-medium"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active && "text-[var(--lab-accent,var(--primary))]",
        )}
        aria-hidden
      />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/**
 * Navigasi modul Research Hub. Zona ditampilkan sebagai tahap alur riset
 * bernomor (memang berurutan). Bisa diciutkan jadi rel ikon supaya tabel
 * lebar dapat ruang; pilihan diingat per browser.
 */
export function ResearchHubModuleSidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/research-hub";
  // Server & render pertama: terbuka; setelah hydrate ikut localStorage.
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  function toggle() {
    writeCollapsed(!collapsed);
  }

  return (
    <aside
      className={cn(
        "sticky top-[4.5rem] z-10 hidden h-[calc(100dvh-5.5rem)] shrink-0 flex-col gap-5 overflow-y-auto py-1 transition-[width] duration-200 motion-reduce:transition-none",
        collapsed ? "w-12" : "w-56 xl:w-60",
        className,
      )}
      aria-label="Navigasi modul Research Hub"
    >
      <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "justify-between px-2.5")}>
        {collapsed ? null : (
          <Link
            href={RESEARCH_HUB_OVERVIEW.href}
            className="text-foreground focus-visible:ring-ring rounded text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            Research Hub
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Lebarkan navigasi" : "Ciutkan navigasi"}
          title={collapsed ? "Lebarkan navigasi" : "Ciutkan navigasi"}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/70 focus-visible:ring-ring rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden />
          )}
        </button>
      </div>

      <nav className="flex flex-col gap-0.5">
        <NavLink
          item={RESEARCH_HUB_OVERVIEW}
          collapsed={collapsed}
          active={isResearchHubNavActive(RESEARCH_HUB_OVERVIEW.href, pathname)}
        />
      </nav>

      {RESEARCH_HUB_ZONES.map((zone) => (
        <nav
          key={zone.id}
          aria-label={`Tahap ${zone.step}: ${zone.label}`}
          className="flex flex-col gap-0.5"
        >
          {collapsed ? (
            <span className="rh-step-dot mx-auto mb-1" aria-hidden>
              {zone.step}
            </span>
          ) : (
            <p className="rh-meta mb-1 flex items-center gap-2 px-2.5" title={zone.summary}>
              <span className="rh-step-dot" aria-hidden>
                {zone.step}
              </span>
              <span className="text-foreground/80 font-medium">{zone.label}</span>
            </p>
          )}
          {zone.items.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              collapsed={collapsed}
              active={isResearchHubNavActive(item.href, pathname)}
            />
          ))}
        </nav>
      ))}

      {collapsed ? null : (
        <p className="rh-meta mt-auto px-2.5 pb-2">
          Scrape dan analisis jalan di background. Kamu bisa pindah modul kapan saja.
        </p>
      )}
    </aside>
  );
}
