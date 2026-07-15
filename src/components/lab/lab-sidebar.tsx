"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  FlaskConical,
  Gauge,
  Home,
  Lock,
  Microscope,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LabAccess } from "@/components/lab/lab-shell";
import { cn } from "@/lib/utils";

type LabNavItem = {
  key: keyof LabAccess | "home";
  href: string;
  label: string;
  icon: LucideIcon;
  lockedLabel?: string;
};

const LAB_NAV: LabNavItem[] = [
  { key: "home", href: "/dominatus-lab", label: "Beranda Lab", icon: Home },
  {
    key: "brandHub",
    href: "/brand-hub",
    label: "Brand & Creative Hub",
    icon: Palette,
    lockedLabel: "Khusus Brand Manager",
  },
  {
    key: "researchHub",
    href: "/research-hub",
    label: "Research Hub",
    icon: Microscope,
    lockedLabel: "Khusus Market Analyst & Brand Manager",
  },
  {
    key: "seo",
    href: "/seo",
    label: "SEO Toolkit",
    icon: Gauge,
    lockedLabel: "Khusus Market Analyst & Brand Manager",
  },
  {
    key: "contentStudio",
    href: "/content-studio",
    label: "Content Studio",
    icon: Sparkles,
    lockedLabel: "Khusus tim studio & Market Analyst",
  },
];

/**
 * Isi navigasi Lab — dipakai rail desktop (mode penuh & ikon) dan Sheet
 * mobile. Item aktif diberi `aria-current="page"` — pill tinta solidnya
 * datang dari rule `nav a[aria-current="page"]` di lab-bento.css.
 */
export function LabNav({
  access,
  collapsed = false,
  onNavigate,
}: {
  access: LabAccess;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex flex-1 flex-col gap-1",
        collapsed && "items-center",
      )}
      aria-label="Navigasi Dominatus Lab"
    >
      {LAB_NAV.map((item) => {
        const unlocked = item.key === "home" || access[item.key];
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        if (!unlocked) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                className={cn(
                  "cursor-default text-sidebar-foreground/40",
                  collapsed
                    ? "relative flex size-10 items-center justify-center rounded-xl"
                    : "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium",
                )}
                aria-disabled
              >
                <Icon className="size-4 shrink-0" />
                {collapsed ? (
                  <Lock className="absolute bottom-1 right-1 size-2.5 shrink-0" />
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-left">
                      {item.label}
                    </span>
                    <Lock className="size-3.5 shrink-0" />
                  </>
                )}
              </TooltipTrigger>
              <TooltipContent side="right">{item.lockedLabel}</TooltipContent>
            </Tooltip>
          );
        }

        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center rounded-xl font-medium transition-colors",
              collapsed
                ? "size-10 justify-center"
                : "gap-2.5 px-3 py-2 text-[13px]",
              active
                ? "text-sidebar-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            )}
          </Link>
        );

        if (!collapsed) return link;

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger render={link} />
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

/** Rail kiri Dominatus Lab (desktop) — bisa diciutkan jadi rail ikon. */
export function LabSidebar({
  access,
  collapsed = false,
  onToggle,
}: {
  access: LabAccess;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Bentangkan sidebar" : "Ciutkan sidebar";

  const toggleButton = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={toggleLabel}
      title={collapsed ? undefined : "Ctrl+B"}
      className={cn(
        "flex items-center rounded-xl text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        collapsed ? "size-10 justify-center" : "w-full gap-2.5 px-3 py-2",
      )}
    >
      <ToggleIcon className="size-4 shrink-0" />
      {!collapsed && <span>Ciutkan sidebar</span>}
    </button>
  );

  const backLink = (
    <Link
      href="/home"
      className={cn(
        "flex items-center rounded-xl text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        collapsed ? "size-10 justify-center" : "gap-2.5 px-3 py-2",
      )}
    >
      <ArrowLeft className="size-4 shrink-0" />
      {collapsed ? (
        <span className="sr-only">Kembali ke DCC</span>
      ) : (
        "Kembali ke DCC"
      )}
    </Link>
  );

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex",
        "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-[4.25rem]" : "w-60",
      )}
    >
      <Link
        href="/dominatus-lab"
        className={cn(
          "flex items-center gap-2.5 pb-4 pt-5",
          collapsed ? "justify-center px-0" : "px-4",
        )}
      >
        <span className="lab-chip flex size-9 shrink-0 items-center justify-center rounded-xl [--lab-accent:#7c3aed] [--lab-accent-2:#8b5cf6]">
          <FlaskConical className="size-4.5" />
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-tight text-sidebar-foreground">
              Dominatus Lab
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
              Research & Creative
            </span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pb-3">
        <LabNav access={access} collapsed={collapsed} />
      </div>

      <div
        className={cn(
          "flex flex-col gap-1 border-t border-sidebar-border p-3",
          collapsed && "items-center",
        )}
      >
        {collapsed ? (
          <>
            <Tooltip>
              <TooltipTrigger render={toggleButton} />
              <TooltipContent side="right">
                {toggleLabel} (Ctrl+B)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={backLink} />
              <TooltipContent side="right">Kembali ke DCC</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            {toggleButton}
            {backLink}
          </>
        )}
      </div>
    </aside>
  );
}
