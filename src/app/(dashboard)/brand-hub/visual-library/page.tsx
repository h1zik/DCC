import { ImageIcon } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ensureBrandHubPage } from "../layout";
import { getBrandVisualLibraryData } from "@/actions/brand-visual-research";
import { BrandVisualLibraryClient } from "./brand-visual-library-client";

export default async function BrandVisualLibraryPage() {
  await ensureBrandHubPage();
  const data = await getBrandVisualLibraryData();

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={ImageIcon}
        title="Visual Library"
        subtitle="Kumpulkan referensi visual dari Pinterest dan listing kompetitor untuk moodboard & creative direction."
      />
      <BrandVisualLibraryClient data={data} />
    </div>
  );
}
