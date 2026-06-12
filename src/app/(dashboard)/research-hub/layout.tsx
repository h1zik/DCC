import { ensureResearchHubPage } from "@/lib/ensure-research-hub-page";
import { ResearchHubSubNav } from "@/components/research-hub/research-hub-sub-nav";

export default async function ResearchHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureResearchHubPage();
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <ResearchHubSubNav />
      {children}
    </div>
  );
}
