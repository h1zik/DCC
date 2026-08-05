import { notFound } from "next/navigation";
import { UserSearch } from "lucide-react";
import { BrandHubDetailPage } from "@/components/brand-hub/brand-hub-list-page";
import { getInfluencerProfileDetail } from "@/lib/brand-research/influencer/readers";
import {
  influencerListHref,
  INFLUENCER_RETURN_PARAM,
} from "@/lib/brand-research/influencer/list-filter";
import { ensureBrandHubPage } from "../../layout";
import {
  InfluencerDetailClient,
  type AuditView,
  type ProfileView,
} from "./influencer-detail-client";

export default async function BrandInfluencerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ brandId?: string; [INFLUENCER_RETURN_PARAM]?: string }>;
}) {
  await ensureBrandHubPage();
  const { profileId } = await params;
  const { brandId, [INFLUENCER_RETURN_PARAM]: from } = await searchParams;

  const profile = await getInfluencerProfileDetail(profileId, brandId ?? null);
  if (!profile) notFound();

  const profileView: ProfileView = {
    id: profile.id,
    platform: profile.platform,
    handle: profile.handle,
    profileUrl: profile.profileUrl,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    isVerified: profile.isVerified,
    notes: profile.notes,
    brandName: profile.ownerBrand?.name ?? null,
  };

  const audits: AuditView[] = profile.audits.map((a) => ({
    id: a.id,
    status: a.status,
    errorMessage: a.errorMessage,
    createdAt: a.createdAt.toISOString(),
    collectedAt: a.collectedAt?.toISOString() ?? null,
    followers: a.followers,
    following: a.following,
    postCount: a.postCount,
    tier: a.tier,
    postsFetched: a.postsFetched,
    postsAnalyzed: a.postsAnalyzed,
    sampleWindowDays: a.sampleWindowDays,
    confidence: a.confidence,
    medianLikes: a.medianLikes,
    medianComments: a.medianComments,
    medianShares: a.medianShares,
    medianViews: a.medianViews,
    avgLikes: a.avgLikes,
    avgComments: a.avgComments,
    avgShares: a.avgShares,
    avgViews: a.avgViews,
    engagementRate: a.engagementRate,
    totalEngagementRate: a.totalEngagementRate,
    viewEngagementRate: a.viewEngagementRate,
    viewRate: a.viewRate,
    feedPostCount: a.feedPostCount,
    reelsPostCount: a.reelsPostCount,
    reelsEngagementRate: a.reelsEngagementRate,
    postsPerWeek: a.postsPerWeek,
    daysSinceLastPost: a.daysSinceLastPost,
    sponsoredCount: a.sponsoredCount,
    organicCount: a.organicCount,
    sponsoredEr: a.sponsoredEr,
    organicEr: a.organicEr,
    sponsoredDeltaPct: a.sponsoredDeltaPct,
    expectedCampaignEr: a.expectedCampaignEr,
    score: a.score,
    verdict: a.verdict,
    benchmarkEr: a.benchmarkEr,
    authenticityScore: a.authenticityScore,
    fakeFlags: a.fakeFlags,
    metrics: a.metrics,
    aiSummary: a.aiSummary,
    posts: a.posts.map((p) => ({
      id: p.id,
      url: p.url,
      caption: p.caption,
      thumbnailUrl: p.thumbnailUrl,
      mediaType: p.mediaType,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      views: p.views,
      saves: p.saves,
      engagementRate: p.engagementRate,
      isSponsored: p.isSponsored,
      inSample: p.inSample,
      surface: p.surface,
      isPinned: p.isPinned,
      postedAt: p.postedAt?.toISOString() ?? null,
    })),
  }));

  // Kembali ke daftar dengan filter yang sama persis seperti saat ditinggalkan.
  // Nilai `from` datang dari URL, jadi dicuci dulu lewat parser filter.
  const backHref = influencerListHref("/brand-hub/influencer-audit", {
    brandId,
    from,
  });

  return (
    <BrandHubDetailPage
      icon={UserSearch}
      title={`@${profile.handle}`}
      description={
        profile.displayName ??
        "Audit engagement & keaslian audiens influencer."
      }
      backHref={backHref}
    >
      <InfluencerDetailClient profile={profileView} audits={audits} />
    </BrandHubDetailPage>
  );
}
