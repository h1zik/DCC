"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { DirectChatHeaderButton } from "@/components/direct-chat/direct-chat-header-button";
import { NotificationBell } from "@/components/notification-bell";
import { OnlinePresence } from "@/components/online-presence";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

function SidebarToggleButton() {
  const { open, openMobile, isMobile, toggleSidebar } = useSidebar();
  const expanded = isMobile ? openMobile : open;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      data-expanded={expanded ? "true" : "false"}
      onClick={toggleSidebar}
      aria-label={expanded ? "Ciutkan menu navigasi" : "Perluas menu navigasi"}
      aria-expanded={expanded}
      title={expanded ? "Ciutkan menu (Ctrl+B)" : "Perluas menu (Ctrl+B)"}
      className={cn(
        "relative size-9 shrink-0 overflow-hidden rounded-lg border border-transparent",
        "transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out",
        "hover:border-border/80 hover:bg-muted/70 hover:shadow-sm",
        "active:scale-[0.96]",
        "data-[expanded=true]:border-primary/25 data-[expanded=true]:bg-primary/10 data-[expanded=true]:text-primary",
      )}
    >
      <PanelLeftOpen
        aria-hidden
        className={cn(
          "absolute size-[1.125rem] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          expanded
            ? "pointer-events-none scale-50 opacity-0 -rotate-90"
            : "scale-100 opacity-100 rotate-0",
        )}
      />
      <PanelLeftClose
        aria-hidden
        className={cn(
          "absolute size-[1.125rem] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          expanded
            ? "scale-100 opacity-100 rotate-0"
            : "pointer-events-none scale-50 opacity-0 rotate-90",
        )}
      />
    </Button>
  );
}

export function DashboardHeader() {
  return (
    <header className="border-border/70 bg-background/90 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <SidebarToggleButton />

        <div
          className="bg-border/70 hidden h-6 w-px shrink-0 sm:block"
          aria-hidden
        />

        <div className="flex min-w-0 flex-col leading-none">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
            Workspace
          </span>
          <span className="text-foreground truncate text-sm font-semibold tracking-tight">
            Command Center
          </span>
        </div>

        <div
          className="bg-border/60 mx-0.5 hidden h-5 w-px shrink-0 md:block"
          aria-hidden
        />

        <div className="hidden min-w-0 md:block">
          <OnlinePresence />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="md:hidden">
          <OnlinePresence />
        </div>

        <div className="flex items-center gap-1" role="toolbar" aria-label="Aksi cepat">
          <DirectChatHeaderButton />
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
