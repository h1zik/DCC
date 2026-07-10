"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { AgentPanelToggle } from "@/components/agent/agent-right-panel";
import { DirectChatHeaderButton } from "@/components/direct-chat/direct-chat-header-button";
import { NotificationBell } from "@/components/notification-bell";
import { OnlinePresence } from "@/components/online-presence";
import { ThemeMenu } from "@/components/theme-menu";
import { cn } from "@/lib/utils";

/**
 * Tombol aksi di dalam pill toolbar dibuat "blend": tanpa border/latar sendiri,
 * mengandalkan hover & state aktif masing-masing komponen.
 */
const headerActionClass =
  "rounded-full border-transparent bg-transparent shadow-none dark:border-transparent dark:bg-transparent";

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
    <header className="border-border/60 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-gradient-to-b from-background/95 to-background/80 px-3 shadow-[0_1px_2px_-1px_rgb(0_0_0/0.06)] backdrop-blur-md sm:gap-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <SidebarToggleButton />

        <div
          className="bg-border/60 hidden h-5 w-px shrink-0 sm:block"
          aria-hidden
        />

        <div className="flex min-w-0 flex-col leading-none">
          <span className="text-muted-foreground/80 hidden items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase sm:flex">
            <span className="bg-primary size-1.5 rounded-full" aria-hidden />
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

        <div
          className="border-border/60 bg-muted/40 flex items-center gap-0.5 rounded-full border p-0.5"
          role="toolbar"
          aria-label="Aksi cepat"
        >
          <AgentPanelToggle className={headerActionClass} />
          <DirectChatHeaderButton className={headerActionClass} />
          <ThemeMenu className={headerActionClass} />
          <NotificationBell className={headerActionClass} />
        </div>
      </div>
    </header>
  );
}
