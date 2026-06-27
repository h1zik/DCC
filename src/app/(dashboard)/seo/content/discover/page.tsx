import { Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  TopicDiscoveryClient,
  type DiscoveryRun,
} from "./discover-client";

export default async function SeoTopicDiscoverPage() {
  const runs = await prisma.seoContentTopicRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const rows: DiscoveryRun[] = runs.map((r) => ({
    id: r.id,
    seed: r.seed,
    status: r.status,
    suggestions: (r.suggestions as DiscoveryRun["suggestions"]) ?? [],
    dataNotice: r.dataNotice,
    errorMessage: r.errorMessage,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <SeoModulePage
      icon={Sparkles}
      title="Topic Discovery"
      description="Dari satu kategori/seed → keyword + judul ter-grounding data (volume, difficulty, intent, tren + judul yang sedang ranking). Diurut berdasarkan opportunity (winnable + worth it), bukan sekadar populer."
    >
      <TopicDiscoveryClient runs={rows} />
    </SeoModulePage>
  );
}
