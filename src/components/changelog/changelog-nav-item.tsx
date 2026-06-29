"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useChangelogUnseen } from "@/lib/changelog/use-unseen";

/**
 * Item sidebar "Apa yang Baru" + badge unseen.
 * Mandiri (membaca localStorage sendiri) sehingga tampil sama untuk
 * semua peran tanpa perlu menyentuh array navigasi per-peran.
 */
export function ChangelogNavItem({ className }: { className?: string }) {
  const pathname = usePathname();
  const { unseenCount, hasUnseen } = useChangelogUnseen();
  const isActive = pathname === "/changelog" || pathname.startsWith("/changelog/");
  const countLabel = unseenCount > 9 ? "9+" : String(unseenCount);

  return (
    <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={hasUnseen ? `Apa yang Baru · ${countLabel} baru` : "Apa yang Baru"}
          isActive={isActive}
          className={className}
          render={<Link href="/changelog" />}
        >
          <span className="relative inline-flex shrink-0">
            <Megaphone />
            {/* Titik merah saat sidebar terkolaps (label tersembunyi). */}
            {hasUnseen ? (
              <span
                className="bg-primary absolute -right-0.5 -top-0.5 size-2 rounded-full opacity-0 ring-2 ring-sidebar transition-opacity group-data-[collapsible=icon]:opacity-100"
                aria-hidden
              />
            ) : null}
          </span>
          <span className="sidebar-nav-label inline-flex min-w-0 flex-1 items-center justify-between gap-1.5">
            <span className="truncate">Apa yang Baru</span>
            {hasUnseen ? (
              <span className="bg-primary text-primary-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none">
                {countLabel}
              </span>
            ) : null}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
