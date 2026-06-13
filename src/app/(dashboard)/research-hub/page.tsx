import { Microscope } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ResearchCommandCenter } from "@/components/research-hub/research-command-center";
import { getResearchDashboardData } from "@/lib/research/dashboard/get-dashboard-data";

export default async function ResearchHubPage() {
  const data = await getResearchDashboardData();

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={Microscope}
        title="Research Hub"
        subtitle="Command center riset pasar — review, kompetitor, tren, social listening, USP, konsep produk, hingga laporan dalam satu tempat."
      />
      <ResearchCommandCenter data={data} />
    </div>
  );
}
