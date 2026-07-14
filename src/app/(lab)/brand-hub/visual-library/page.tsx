import { ImageIcon } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { ensureBrandHubPage } from "../layout";
import { getBrandVisualLibraryData } from "@/actions/brand-visual-research";
import { BrandVisualLibraryClient } from "./brand-visual-library-client";

export default async function BrandVisualLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  await ensureBrandHubPage();
  const { brandId } = await searchParams;
  const data = await getBrandVisualLibraryData(brandId ?? null);

  return (
    <BrandHubListPage
      icon={ImageIcon}
      eyebrow="Studio"
      title="Visual Library"
      subtitle="Kumpulkan referensi visual dari Pinterest, kompetitor, social, dan upload manual untuk moodboard & creative direction."
    >
      <BrandVisualLibraryClient data={data} defaultBrandId={brandId ?? null} />
    </BrandHubListPage>
  );
}
