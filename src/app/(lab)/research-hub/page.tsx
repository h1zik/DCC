import { getResearchDashboardData } from "@/lib/research/dashboard/get-dashboard-data";
import { ResearchCommandCenter } from "@/components/research-hub/research-command-center";

export default async function ResearchHubPage() {
  const data = await getResearchDashboardData();

  return <ResearchCommandCenter data={data} />;
}
