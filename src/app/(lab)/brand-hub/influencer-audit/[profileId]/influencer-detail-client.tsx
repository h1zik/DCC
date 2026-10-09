"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  RefreshCw,
  Share2,
  Sparkles,
} from "lucide-react";
import { InfluencerAuditStatus, InfluencerPlatform } from "@prisma/client";
import { toast } from "sonner";
import { reauditInfluencer } from "@/actions/brand-influencer";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
import {
  AuditStatusPill,
  compactNumber,
  FakeFlagList,
  InfluencerAvatar,
  isAuditInProgress,
  parseFakeFlags,
  PLATFORM_LABEL,
  TIER_LABEL,
} from "@/components/brand-hub/influencer-badges";
import { InfluencerMethodology } from "@/components/brand-hub/influencer-methodology";
import { readAuditTrust } from "@/lib/brand-research/influencer/metrics-view";
import { cn } from "@/lib/utils";
import { useBrandJobProgress } from "../../use-brand-job-progress";
import {
  BenchmarkBar,
  BrandSafetyPanel,
  CommentQualityPanel,
  MetricTile,
  NotesEditor,
  pct,
  pctMeasured,
  PostTable,
  readBoolean,
  readBrandSafety,
  readCommentQuality,
  readComponents,
  readNarrative,
  readNumber,
  readString,
  SponsoredPanel,
  SurfacePanel,
} from "./_components/audit-panels";
import { AuditHistoryChart, ErDistributionChart } from "./_components/audit-charts";
import { DecisionBlock, KeyNumbers } from "./_components/decision-block";
import type { AuditView, ProfileView } from "./_components/types";

export type { AuditView, PostView, ProfileView } from "./_components/types";

const TABS = [
  "performa",
  "keaslian",
  "keamanan",
  "post",
  "riwayat",
  "metodologi",
] as const;
type TabKey = (typeof TABS)[number];
const TAB_PARAM = "tab";

/**
 * Tab aktif disimpan di URL (tanpa render ulang server) supaya tautan yang
 * dikirim ke rekan langsung membuka bagian yang dimaksud.
 */
function useTabParam(): [TabKey, (next: TabKey) => void] {
  const searchParams = useSearchParams();
  const initial = searchParams.get(TAB_PARAM);
  const [tab, setTab] = useState<TabKey>(
    (TABS as readonly string[]).includes(initial ?? "")
      ? (initial as TabKey)
      : "performa",
  );

  function update(next: TabKey) {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "performa") params.delete(TAB_PARAM);
    else params.set(TAB_PARAM, next);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }

  return [tab, update];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function InfluencerDetailClient({
  profile,
  audits,
}: {
  profile: ProfileView;
  audits: AuditView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useTabParam();
  const latest = audits[0] ?? null;
  const running = isAuditInProgress(latest?.status);

  useBrandJobProgress({ inProgress: running });

  const readyAudit =
    audits.find((a) => a.status === InfluencerAuditStatus.READY) ?? null;
  const readyAuditCount = audits.filter(
    (a) => a.status === InfluencerAuditStatus.READY,
  ).length;

  function reaudit() {
    startTransition(async () => {
      try {
        await reauditInfluencer(profile.id);
        toast.success("Audit ulang dijalankan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menjalankan audit ulang."));
      }
    });
  }

  const metrics = readyAudit?.metrics;
  const trust = readAuditTrust(metrics);
  const flags = parseFakeFlags(readyAudit?.fakeFlags);
  const narrative = readNarrative(metrics);
  const trendPct = readNumber(metrics, "engagementTrendPct");
  const commentLikeRatio = readNumber(metrics, "commentLikeRatio");
  const viralSkew = readNumber(metrics, "viralSkew");
  const campaignSource = readString(metrics, "expectedCampaignErSource");
  const primarySurface = readString(metrics, "primarySurface");
  const hiddenLikePosts = readNumber(metrics, "hiddenLikePosts");
  const engagementMeasurable = readBoolean(metrics, "engagementMeasurable");
  // Like yang disembunyikan tidak menghapus seluruh data: komentar tetap
  // publik, jadi ER-nya diperkirakan. Angka perkiraan ditandai "≈".
  const imputedEngagementRate = readNumber(metrics, "imputedEngagementRate");
  const hiddenSponsoredPosts = readNumber(metrics, "hiddenSponsoredPosts");
  const brandSafetyHits = readBrandSafety(metrics);
  const commentQuality = readCommentQuality(metrics);

  const integrityFlags = flags.filter((f) => f.impact !== "brandSafety");
  const findingCount = flags.filter(
    (f) => f.impact === "authenticity" || f.impact === "performance",
  ).length;
  const sampleMedianEr = readyAudit
    ? median(
        readyAudit.posts
          .filter((p) => p.inSample && p.likes >= 0)
          .map((p) => p.engagementRate),
      )
    : 0;
  const surfaceLabel =
    trust.primaryMode === "blended"
      ? "feed dan Reels"
      : primarySurface === "reels"
        ? "Reels"
        : primarySurface === "feed"
          ? "post feed"
          : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Identitas: ringkas, karena keputusan ada di bawahnya. */}
      <div className="flex flex-wrap items-center gap-4">
        <InfluencerAvatar
          src={profile.avatarUrl}
          handle={profile.handle}
          className="size-14 text-base"
        />
        <div className="min-w-0 flex-1">
          <p className="text-foreground flex items-center gap-1.5 text-lg font-semibold">
            @{profile.handle}
            {profile.isVerified ? (
              <BadgeCheck className="size-4 text-sky-500" aria-label="Terverifikasi" />
            ) : null}
          </p>
          <p className="text-muted-foreground text-sm">
            {PLATFORM_LABEL[profile.platform]}
            {readyAudit?.tier ? `, ${TIER_LABEL[readyAudit.tier]}` : ""}
            {readyAudit ? `, ${compactNumber(readyAudit.followers)} follower` : ""}
            {profile.brandName ? `, untuk ${profile.brandName}` : ""}
          </p>
          {profile.bio ? (
            <p className="text-muted-foreground mt-1 line-clamp-2 max-w-prose text-xs leading-relaxed">
              {profile.bio}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {latest && latest.status !== InfluencerAuditStatus.READY ? (
            <AuditStatusPill status={latest.status} />
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={reaudit}
            disabled={pending || running}
            className="gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
            Audit ulang
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            render={
              <a href={profile.profileUrl} target="_blank" rel="noreferrer noopener" />
            }
          >
            Buka profil
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      </div>

      {running ? (
        <JobProgressBar
          percent={latest?.status === InfluencerAuditStatus.ANALYZING ? 75 : 40}
          title="Audit berjalan"
          stepLabel={
            latest?.status === InfluencerAuditStatus.ANALYZING
              ? "Menilai engagement & keaslian audiens…"
              : "Mengambil profil dan post terbaru dari Apify…"
          }
        />
      ) : null}

      {latest?.status === InfluencerAuditStatus.FAILED && latest.errorMessage ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--iv-fraud)_35%,transparent)] bg-[color-mix(in_srgb,var(--iv-fraud)_6%,transparent)] p-4">
          <p className="text-foreground max-w-prose text-sm leading-relaxed">
            <strong className="font-semibold">Audit terakhir gagal.</strong>{" "}
            {latest.errorMessage}
            {readyAudit ? " Hasil di bawah berasal dari audit sebelumnya yang berhasil." : ""}
          </p>
          <Button size="sm" variant="outline" onClick={reaudit} disabled={pending}>
            Coba lagi
          </Button>
        </div>
      ) : null}

      {!readyAudit ? (
        !running && latest?.status !== InfluencerAuditStatus.FAILED ? (
          <LabEmptyState
            icon={Sparkles}
            title="Belum ada hasil audit"
            description="Jalankan audit untuk mengambil post terbaru dan menghitung engagement."
          />
        ) : null
      ) : (
        <>
          <DecisionBlock audit={readyAudit} trust={trust} narrative={narrative} />

          <KeyNumbers
            audit={readyAudit}
            trust={trust}
            platform={profile.platform}
            engagementMeasurable={engagementMeasurable}
            imputedEngagementRate={imputedEngagementRate}
            campaignFromPaid={campaignSource === "sponsored"}
          />

          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="gap-5">
            <div className="-mx-1 overflow-x-auto px-1">
              <TabsList variant="line" className="border-border/70 h-auto w-full justify-start gap-4 rounded-none border-b pb-1">
                <TabsTrigger value="performa" className="flex-none px-0">Performa</TabsTrigger>
                <TabsTrigger value="keaslian" className="flex-none px-0">
                  Keaslian
                  {findingCount > 0 ? (
                    <span className="bg-muted text-foreground rounded-full px-1.5 text-[11px] tabular-nums">
                      {findingCount}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="keamanan" className="flex-none px-0">
                  Keamanan merek
                  {brandSafetyHits.length > 0 ? (
                    <span className="size-1.5 rounded-full bg-[var(--iv-fraud)]" aria-label="ada temuan" />
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="post" className="flex-none px-0">
                  Post
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {readyAudit.postsAnalyzed}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="riwayat" className="flex-none px-0">Riwayat</TabsTrigger>
                <TabsTrigger value="metodologi" className="flex-none px-0">Metodologi</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="performa" className="flex flex-col gap-8">
              <LabSection
                title="Posisi terhadap pembanding"
                description={`Median dari ${readyAudit.postsAnalyzed} post (dari ${readyAudit.postsFetched} yang diambil${readyAudit.sampleWindowDays !== null ? `, mencakup ${readyAudit.sampleWindowDays} hari` : ""})${surfaceLabel ? `, dihitung dari ${surfaceLabel}` : ""}.${hiddenLikePosts ? ` ${hiddenLikePosts} post menyembunyikan jumlah like — angkanya diperkirakan dari komentar, bukan dianggap nol.` : ""}${hiddenSponsoredPosts ? ` ${hiddenSponsoredPosts} di antaranya post berbayar.` : ""}`}
              >
                {readyAudit.benchmarkEr && engagementMeasurable !== false ? (
                  <BenchmarkBar
                    er={readyAudit.engagementRate}
                    benchmark={readyAudit.benchmarkEr}
                    interval={trust.erInterval}
                    peerMedian={trust.peerMedianEr}
                    peerCount={trust.peerCount}
                  />
                ) : null}
                <ErDistributionChart
                  posts={readyAudit.posts}
                  benchmarkEr={readyAudit.benchmarkEr}
                  medianEr={sampleMedianEr}
                />
              </LabSection>

              <LabSection title="Angka per post">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricTile
                    label="Like (median)"
                    value={compactNumber(readyAudit.medianLikes)}
                    hint={
                      viralSkew !== null && viralSkew > 1.3
                        ? `Rata-rata ${compactNumber(readyAudit.avgLikes)}, ${viralSkew.toFixed(1)}× median`
                        : `Rata-rata ${compactNumber(readyAudit.avgLikes)}`
                    }
                    icon={Heart}
                    tone={viralSkew !== null && viralSkew > 2 ? "warn" : "neutral"}
                  />
                  <MetricTile
                    label="Komentar (median)"
                    value={compactNumber(readyAudit.medianComments)}
                    hint={
                      commentLikeRatio !== null
                        ? `${(commentLikeRatio * 100).toFixed(1)}% dari like`
                        : undefined
                    }
                    icon={MessageCircle}
                  />
                  <MetricTile
                    label="Share (median)"
                    value={readyAudit.medianShares > 0 ? compactNumber(readyAudit.medianShares) : "—"}
                    hint={`ER penuh termasuk share & simpan: ${pctMeasured(readyAudit.totalEngagementRate, engagementMeasurable)}`}
                    icon={Share2}
                  />
                  <MetricTile
                    label="ER terhadap view"
                    value={pct(readyAudit.viewEngagementRate)}
                    hint={
                      trendPct !== null
                        ? `Tren post terbaru vs terlama: ${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(0)}%`
                        : "Seberapa banyak penonton ikut berinteraksi"
                    }
                    icon={Eye}
                  />
                </div>
              </LabSection>

              {profile.platform === InfluencerPlatform.INSTAGRAM &&
              readyAudit.reelsPostCount > 0 ? (
                <LabSection
                  title="Feed vs Reels"
                  description="Di Instagram, grid profil dan tab Reels adalah dua koleksi terpisah dengan perilaku berbeda — digabung jadi satu angka, keduanya saling menutupi."
                >
                  <SurfacePanel audit={readyAudit} />
                </LabSection>
              ) : null}

              <LabSection
                title="Post berbayar vs organik"
                description="Post endorse hampir selalu lebih rendah engagement-nya. Angka berbayar inilah yang akan Anda dapat, bukan ER umumnya."
              >
                <SponsoredPanel audit={readyAudit} />
              </LabSection>
            </TabsContent>

            <TabsContent value="keaslian" className="flex flex-col gap-8">
              <LabSection
                title="Sinyal yang ditemukan"
                description={`Skor keaslian ${readyAudit.authenticityScore}/100. Sinyal dikelompokkan menurut apa yang dipertanyakannya; keterbatasan data tidak menghukum skor.`}
              >
                {trust.followerGrowth ? (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Follower berubah{" "}
                    <strong className="text-foreground">
                      {trust.followerGrowth.pct > 0 ? "+" : ""}
                      {trust.followerGrowth.pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
                    </strong>{" "}
                    dalam {trust.followerGrowth.days} hari sejak pengukuran sebelumnya (
                    {compactNumber(trust.followerGrowth.previousFollowers)} →{" "}
                    {compactNumber(readyAudit.followers)}).
                  </p>
                ) : null}
                <FakeFlagList flags={integrityFlags} />
              </LabSection>

              {commentQuality ? (
                <LabSection
                  title="Kualitas komentar"
                  description="Jumlah komentar saja tidak membedakan audiens yang benar-benar tertarik dari kolom komentar yang penuh emoji."
                >
                  <CommentQualityPanel quality={commentQuality} />
                </LabSection>
              ) : null}
            </TabsContent>

            <TabsContent value="keamanan">
              <LabSection
                title="Risiko asosiasi merek"
                description="Engagement bagus tidak menolong kalau merek Anda berdiri di samping konten yang salah. Dipindai dari caption seluruh post yang diambil, termasuk yang sudah di luar jendela penilaian."
              >
                <BrandSafetyPanel hits={brandSafetyHits} />
              </LabSection>
            </TabsContent>

            <TabsContent value="post">
              <PostTable posts={readyAudit.posts} />
            </TabsContent>

            <TabsContent value="riwayat">
              <LabSection
                title="Riwayat audit"
                description="Satu titik untuk tiap kali audit dijalankan — bukan tren postingan. Follower yang melonjak sementara ER jatuh adalah pola follower dibeli."
              >
                {readyAuditCount > 1 ? (
                  <AuditHistoryChart audits={audits} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Baru ada satu audit yang selesai. Jalankan audit ulang
                    menjelang deal — engagement bisa berubah antara saat
                    di-scout dan saat dikontrak, dan riwayat inilah yang
                    menangkap lonjakan follower.
                  </p>
                )}
              </LabSection>
            </TabsContent>

            <TabsContent value="metodologi">
              <InfluencerMethodology
                audit={{
                  ...readyAudit,
                  primarySurface,
                  feedEngagementRate: readNumber(metrics, "feedEngagementRate"),
                  hiddenLikePosts: hiddenLikePosts ?? 0,
                  analyzedComments: commentQuality?.analyzedComments ?? 0,
                  brandSafetyHitCount: brandSafetyHits.length,
                }}
                components={readComponents(metrics)}
                trust={trust}
                defaultOpen
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <LabSection title="Catatan internal">
        <NotesEditor profileId={profile.id} initial={profile.notes} />
      </LabSection>
    </div>
  );
}
