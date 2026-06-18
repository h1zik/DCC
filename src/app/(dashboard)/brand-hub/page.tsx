import { Palette } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ensureBrandHubPage } from "./layout";
import { getBrandHubDashboardData } from "@/lib/brand-research/dashboard";
import { BrandHubCommandCenter } from "./brand-hub-overview-client";

export default async function BrandHubPage() {
  const session = await ensureBrandHubPage();
  const data = await getBrandHubDashboardData(session.user.id);

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={Palette}
        title="Brand & Creative Hub"
        subtitle="Command center riset brand & creative — pantau kompetitor, review konsumen, tren visual, social listening, dan USP untuk mempercepat decision-making tim brand."
      />
      <BrandHubCommandCenter data={data} />
    </div>
  );
}