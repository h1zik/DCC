import { ensureResearchHubPage } from "@/lib/ensure-research-hub-page";
import { ResearchHubSubNav } from "@/components/research-hub/research-hub-sub-nav";
import { BackgroundJobIndicator } from "@/components/research-hub/background-job-indicator";
import { ResearchHubModuleSidebar } from "@/components/research-hub/research-hub-module-sidebar";
import "@/components/research-hub/kit/research-hub.css";

export default async function ResearchHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureResearchHubPage();
  return (
    // Skin bento global dari lab-theme/lab-bento; hue violet + skala tipe
    // "meja riset" (rh-scope) khusus Research Hub.
    <div className="lab-hue-violet rh-scope flex w-full min-w-0 gap-6 lg:gap-8">
      <ResearchHubModuleSidebar className="lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ResearchHubSubNav className="lg:hidden" />
        <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
          {children}
        </div>
        <BackgroundJobIndicator />
      </div>
    </div>
  );
}
