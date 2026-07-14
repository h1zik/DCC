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

/** Isi navigasi Lab — dipakai rail desktop & Sheet mobile. */
export function LabNav({
  access,
  onNavigate,
}: {
  access: LabAccess;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Navigasi Dominatus Lab">
      {LAB_NAV.map((item) => {
        const unlocked = item.key === "home" || access[item.key];
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        if (!unlocked) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                className="flex w-full cursor-default items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-sidebar-foreground/40"
                aria-disabled
              >
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">
                  {item.label}
                </span>
                <Lock className="size-3.5 shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="right">{item.lockedLabel}</TooltipContent>
            </Tooltip>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "relative flex items-center gap-2.5 rounded-xl border-l-2 border-l-transparent px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "border-l-sidebar-primary bg-gradient-to-r from-sidebar-primary/[0.16] via-sidebar-accent/40 to-transparent text-sidebar-foreground [&_svg]:text-sidebar-primary"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Rail kiri Dominatus Lab (desktop). */
export function LabSidebar({ access }: { access: LabAccess }) {
  return (
    <aside className="sticky top-0 z-30 hidden h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/70 backdrop-blur-xl lg:flex">
      <Link
        href="/dominatus-lab"
        className="flex items-center gap-2.5 px-4 pb-4 pt-5"
      >
        <span className="lab-chip flex size-9 items-center justify-center rounded-xl [--lab-accent:#7c3aed] [--lab-accent-2:#06b6d4]">
          <FlaskConical className="size-4.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold tracking-tight text-sidebar-foreground">
            Dominatus Lab
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
            Research & Creative
          </span>
        </span>
      </Link>

      <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-3">
        <LabNav access={access} />
      </div>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/home"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
        >
          <ArrowLeft className="size-4 shrink-0" />
          Kembali ke DCC
        </Link>
      </div>
    </aside>
  );
}
