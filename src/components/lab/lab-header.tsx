"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LabNav } from "@/components/lab/lab-sidebar";
import { LabThemeToggle } from "@/components/lab/lab-theme-toggle";
import { LabUserMenu, type LabUser } from "@/components/lab/lab-user-menu";
import type { LabAccess } from "@/components/lab/lab-shell";

const MODULE_TITLES: [prefix: string, title: string][] = [
  ["/brand-hub", "Brand & Creative Hub"],
  ["/research-hub", "Research Hub"],
  ["/seo", "SEO Toolkit"],
  ["/content-studio", "Content Studio"],
  ["/dominatus-lab", "Beranda Lab"],
];

function moduleTitle(pathname: string): string {
  for (const [prefix, title] of MODULE_TITLES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return title;
  }
  return "Dominatus Lab";
}

/** Header Lab yang bersih: menu mobile, judul modul, toggle tema, profil. */
export function LabHeader({
  access,
  user,
}: {
  access: LabAccess;
  user: LabUser;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label="Buka navigasi Lab"
              className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            >
              <Menu className="size-4" />
            </button>
          }
        />
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-border px-4 py-4">
            <SheetTitle className="text-sm font-bold tracking-tight">
              Dominatus Lab
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col overflow-y-auto p-3">
            <LabNav access={access} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold tracking-tight">
          {moduleTitle(pathname)}
        </span>
      </div>

      <LabThemeToggle />
      <LabUserMenu user={user} />
    </header>
  );
}
