import { Radar } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import {
  getRadarStats,
  listPopulatedCategories,
  listRadarCreators,
} from "@/lib/brand-research/influencer/discovery/radar-readers";
import { parseRadarFilters } from "@/lib/brand-research/influencer/discovery/radar-query";
import { fetchDiscoveryRuns } from "@/actions/brand-influencer-discovery";
import { ensureBrandHubPage } from "../layout";
import { KolRadarClient } from "./kol-radar-client";

export default async function KolRadarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await ensureBrandHubPage();

  // Filter dibaca dari URL supaya tampilan yang sudah disaring bisa dikirim ke
  // rekan lewat link, dan bertahan saat tombol kembali ditekan.
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }
  const filters = parseRadarFilters(params);

  const [page, stats, categories, runs] = await Promise.all([
    listRadarCreators(filters),
    getRadarStats(),
    listPopulatedCategories(),
    fetchDiscoveryRuns(10),
  ]);

  return (
    <BrandHubListPage
      icon={Radar}
      eyebrow="Creative Intelligence"
      title="KOL Radar"
      subtitle="Sisir hashtag untuk menemukan kreator yang belum Anda kenal, lalu peringkatkan mereka menurut niche, ukuran, dan engagement — sebelum memutuskan siapa yang layak diaudit penuh."
    >
      <KolRadarClient
        filters={filters}
        page={page}
        stats={stats}
        categories={categories}
        runs={runs.map((r) => ({
          id: r.id,
          status: r.status,
          terms: r.terms,
          platforms: r.platforms,
          searchLimit: r.searchLimit,
          postsScanned: r.postsScanned,
          profilesFound: r.profilesFound,
          profilesNew: r.profilesNew,
          warnings: Array.isArray(r.warnings)
            ? (r.warnings as unknown[]).filter(
                (w): w is string => typeof w === "string",
              )
            : [],
          errorMessage: r.errorMessage,
          createdAt: r.createdAt.toISOString(),
          finishedAt: r.finishedAt?.toISOString() ?? null,
          createdByName: r.createdBy?.name ?? null,
        }))}
      />
    </BrandHubListPage>
  );
}
