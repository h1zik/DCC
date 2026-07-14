import { ensureResearchHubPage } from "@/lib/ensure-research-hub-page";
import { ResearchHubSubNav } from "@/components/research-hub/research-hub-sub-nav";
import { ResearchHubModuleHint } from "@/components/research-hub/research-hub-module-hint";
import { BackgroundJobIndicator } from "@/components/research-hub/background-job-indicator";
import { ResearchHubModuleSidebar } from "@/components/research-hub/research-hub-module-sidebar";
import { cn } from "@/lib/utils";

export default async function ResearchHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureResearchHubPage();
  return (
    <div
      className="flex w-full min-w-0 gap-6 lg:gap-8"
      style={
        // Duo aksen modul Research Hub (violet) — dikonsumsi Lab primitives.
        { "--lab-accent": "#a78bfa", "--lab-accent-2": "#8b5cf6" } as React.CSSProperties
      }
    >
      <ResearchHubModuleSidebar className="lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ResearchHubSubNav className="lg:hidden" />
        <ResearchHubModuleHint />
        <div
          className={cn(
            "animate-in fade-in duration-300 motion-reduce:animate-none",
          )}
        >
          {children}
        </div>
        <BackgroundJobIndicator />
      </div>
    </div>
  );
}
