import { UserSearch } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import {
  getInfluencerHubStats,
  listInfluencerProfiles,
} from "@/lib/brand-research/influencer/readers";
import { ensureBrandHubPage } from "../layout";
import {
  InfluencerAuditClient,
  type InfluencerRow,
} from "./influencer-audit-client";

/** Sinyal yang benar-benar temuan terhadap influencer (bukan keterbatasan data). */
function countActionableFlags(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.filter((f) => {
    if (!f || typeof f !== "object") return false;
    const impact = (f as { impact?: unknown }).impact;
    return impact === "authenticity" || impact === "performance";
  }).length;
}

export default async function BrandInfluencerAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  await ensureBrandHubPage();
  const { brandId } = await searchParams;

  const [profiles, stats] = await Promise.all([
    listInfluencerProfiles(brandId ?? null),
    getInfluencerHubStats(brandId ?? null),
  ]);

  const rows: InfluencerRow[] = profiles.map((p) => {
    const latest = p.audits[0];
    return {
      id: p.id,
      platform: p.platform,
      handle: p.handle,
      profileUrl: p.profileUrl,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      isVerified: p.isVerified,
      brandName: p.ownerBrand?.name ?? null,
      auditCount: p._count.audits,
      latestStatus: latest?.status ?? null,
      errorMessage: latest?.errorMessage ?? null,
      collectedAt: latest?.collectedAt?.toISOString() ?? null,
      followers: latest?.followers ?? null,
      tier: latest?.tier ?? null,
      engagementRate: latest?.engagementRate ?? null,
      benchmarkEr: latest?.benchmarkEr ?? null,
      score: latest?.score ?? null,
      verdict: latest?.verdict ?? null,
      authenticityScore: latest?.authenticityScore ?? null,
      confidence: latest?.confidence ?? null,
      expectedCampaignEr: latest?.expectedCampaignEr ?? null,
      sponsoredDeltaPct: latest?.sponsoredDeltaPct ?? null,
      // Hitung sinyal keaslian & performa saja — keterbatasan data bukan
      // temuan terhadap influencer-nya, jadi tidak boleh menggelembungkan badge.
      flagCount: countActionableFlags(latest?.fakeFlags),
    };
  });

  return (
    <BrandHubListPage
      icon={UserSearch}
      eyebrow="Creative Intelligence"
      title="Influencer Audit"
      subtitle="Tempel link Instagram/TikTok influencer — dapatkan engagement rate relatif terhadap tiernya, plus deteksi engagement yang dibeli."
    >
      <InfluencerAuditClient profiles={rows} stats={stats} />
    </BrandHubListPage>
  );
}
