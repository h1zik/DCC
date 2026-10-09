import { UserSearch } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import {
  getInfluencerHubStats,
  listInfluencerProfiles,
} from "@/lib/brand-research/influencer/readers";
import { readAuditTrust } from "@/lib/brand-research/influencer/metrics-view";
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
    return (
      impact === "authenticity" ||
      impact === "performance" ||
      impact === "brandSafety"
    );
  }).length;
}

/**
 * Risiko berat harus terbaca dari daftar, bukan hanya setelah dibuka. Orang
 * menyaring kandidat di halaman ini — temuan judi online yang bersembunyi di
 * halaman detail sama saja tidak ada.
 */
function severeRiskLabel(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  const hit = raw.find(
    (f) =>
      !!f &&
      typeof f === "object" &&
      (f as { impact?: unknown }).impact === "brandSafety" &&
      (f as { severity?: unknown }).severity === "high",
  );
  const label = (hit as { label?: unknown } | undefined)?.label;
  return typeof label === "string" ? label : null;
}

/** Permukaan yang jadi dasar ER, supaya angka di kartu tidak ambigu. */
function primarySurfaceLabel(metrics: unknown): string | null {
  if (!metrics || typeof metrics !== "object") return null;
  const surface = (metrics as { primarySurface?: unknown }).primarySurface;
  if (surface === "reels") return "Reels";
  if (surface === "feed") return "Feed";
  return null;
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
    const trust = readAuditTrust(latest?.metrics);
    const ready = latest?.status === "READY";
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
      // Hitung sinyal keaslian, performa & risiko merek — keterbatasan data
      // bukan temuan terhadap influencer-nya, jadi tidak ikut dihitung.
      flagCount: countActionableFlags(latest?.fakeFlags),
      severeRisk: severeRiskLabel(latest?.fakeFlags),
      primarySurface: primarySurfaceLabel(latest?.metrics),
      // Metode v2 — null pada audit lama, yang UI tandai "metode lama".
      scoringVersion: ready ? trust.scoringVersion : null,
      scoreInterval: ready ? trust.scoreInterval : null,
      reliability: ready ? trust.reliability : null,
      peerPercentile: ready ? trust.peerPercentile : null,
    };
  });

  return (
    <BrandHubListPage
      icon={UserSearch}
      eyebrow="Creative Intelligence"
      title="Influencer Audit"
      subtitle="Bandingkan kandidat dari skor, rentang ketidakpastiannya, dan seberapa andal datanya. Halaman ini hanya memuat yang sudah atau sedang diaudit; kandidat mentah hasil crawl ada di KOL Radar."
    >
      <InfluencerAuditClient profiles={rows} stats={stats} />
    </BrandHubListPage>
  );
}
