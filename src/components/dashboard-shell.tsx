"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AgentPanelProvider } from "@/components/agent/agent-panel-context";
import { AgentRightPanel } from "@/components/agent/agent-right-panel";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { cn } from "@/lib/utils";
import { PAGE_GAP_CLASS, PAGE_MAX_WIDTH_CLASS, PAGE_PADDING_CLASS } from "@/components/page-container";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AgentPanelProvider>
        <AppSidebar />
        <SidebarInset className="overflow-x-hidden">
          <DashboardHeader />
          <div className={PAGE_PADDING_CLASS}>
            <div
              className={cn(
                "mx-auto flex w-full min-w-0 flex-1 flex-col",
                PAGE_MAX_WIDTH_CLASS,
                PAGE_GAP_CLASS,
              )}
            >
              {children}
            </div>
          </div>
        </SidebarInset>
        <AgentRightPanel />
      </AgentPanelProvider>
    </SidebarProvider>
  );
}
