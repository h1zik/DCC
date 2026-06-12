import { Microscope } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ResearchModuleGrid } from "@/components/research-hub/research-module-grid";

export default function ResearchHubPage() {
  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={Microscope}
        title="Research Hub"
        subtitle="Pusat riset pasar — review intelligence, competitor tracking, dan insight produk."
      />
      <ResearchModuleGrid />
    </div>
  );
}
