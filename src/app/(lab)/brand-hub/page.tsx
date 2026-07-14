import { ensureBrandHubPage } from "./layout";
import { getBrandHubDashboardData } from "@/lib/brand-research/dashboard";
import { BrandHubCommandCenter } from "./brand-hub-overview-client";

export default async function BrandHubPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  const session = await ensureBrandHubPage();
  const { brandId } = await searchParams;
  const data = await getBrandHubDashboardData(session.user.id, brandId ?? null);

  return <BrandHubCommandCenter data={data} brandId={brandId ?? null} />;
}
