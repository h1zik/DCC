"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AgentPanelProvider } from "@/components/agent/agent-panel-context";
import { AgentRightPanel } from "@/components/agent/agent-right-panel";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { RoomNavProvider } from "@/components/nav/room-nav-context";
import type { NavRoom } from "@/lib/room-nav-data";
import { cn } from "@/lib/utils";
import { PAGE_GAP_CLASS, PAGE_MAX_WIDTH_CLASS, PAGE_PADDING_CLASS } from "@/components/page-container";

export function DashboardShell({
  children,
  navRooms = [],
}: {
  children: React.ReactNode;
  navRooms?: NavRoom[];
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <RoomNavProvider rooms={navRooms}>
        <AgentPanelProvider>
          <AppSidebar />
          <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-x-hidden has-[_[data-chat-shell]]:overflow-hidden">
            <DashboardHeader />
            <div
              className={cn(
                PAGE_PADDING_CLASS,
                "flex min-h-0 flex-1 flex-col",
                "has-[_[data-chat-shell]]:h-[calc(100svh-3.5rem)] has-[_[data-chat-shell]]:max-h-[calc(100svh-3.5rem)] has-[_[data-chat-shell]]:overflow-hidden has-[_[data-chat-shell]]:p-0",
              )}
            >
              <div
                className={cn(
                  "mx-auto flex w-full min-w-0 flex-1 flex-col",
                  PAGE_MAX_WIDTH_CLASS,
                  PAGE_GAP_CLASS,
                  "has-[_[data-chat-shell]]:mx-0 has-[_[data-chat-shell]]:max-w-none has-[_[data-chat-shell]]:min-h-0 has-[_[data-chat-shell]]:flex-1 has-[_[data-chat-shell]]:overflow-hidden has-[_[data-chat-shell]]:gap-0",
                )}
              >
                {children}
              </div>
            </div>
          </SidebarInset>
          <AgentRightPanel />
        </AgentPanelProvider>
      </RoomNavProvider>
    </SidebarProvider>
  );
}
