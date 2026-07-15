"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ImageIcon,
  Megaphone,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { SocialListeningStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  refreshBrandAdLibraryMonitor,
  regenerateBrandAdLibraryAiSummary,
} from "@/actions/brand-meta-ads";
import { harvestAdLibraryVisualsAction } from "@/actions/brand-visual-research";
import { actionErrorMessage } from "@/lib/action-error-message";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { useBrandJobProgress } from "../../use-brand-job-progress";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LabPageHeader, LabSection, lab } from "@/components/lab/lab-primitives";
import { AdCreativeMedia } from "@/components/brand-hub/ad-creative-media";
import { DemoDataBanner } from "@/components/brand-hub/demo-data-banner";
import { isAdVideo, scrapeMediaTypeLabel } from "@/lib/brand-research/ad-library-media";
import type { SelectItemDef } from "@/lib/select-option-items";
import {
  AD_WINNING_TIER_LABEL,
  computeDaysRunning,
  winningTierFromScore,
  type AdWinningTier,
} from "@/lib/brand-research/ad-winning-score";
import { cn } from "@/lib/utils";

const TIER_BADGE_CLASS: Record<AdWinningTier, string> = {
  hot: "bg-red-500/15 text-red-600 dark:text-red-400",
  strong: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  testing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  new: "bg-muted text-muted-foreground",
};

/** Tile galeri iklan: bento rounded-2xl dengan hover lift + border aksen. */
const galleryTileClass =
  "group border-border/70 bg-card flex flex-col overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgb(30_25_15/0.05)] transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_45%,var(--border))] hover:shadow-[0_8px_24px_-12px_rgb(30_25_15/0.25)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

function adDaysRunning(deliveryStart: string | null, deliveryStop: string | null): number | null {
  return computeDaysRunning(
    deliveryStart ? new Date(deliveryStart) : null,
    deliveryStop ? new Date(deliveryStop) : null,
    new Date(),
  );
}

export type AdLibraryAdRow = {
  id: string;
  externalId: string;
  pageName: string | null;
  bodyText: string | null;
  linkTitle: string | null;
  ctaType: string | null;
  ctaText: string | null;
  mediaType: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  snapshotUrl: string | null;
  linkUrl: string | null;
  platforms: string[];
  isActive: boolean;
  deliveryStart: string | null;
  deliveryStop: string | null;
  winningScore: number | null;
  collationCount: number | null;
};

export type AdLibraryAiInsights = {
  dominantFormats?: string[];
  dominantCtas?: string[];
  hookPatterns?: string[];
  creativeRecommendations?: string[];
};

export type AdLibraryDetailData = {
  id: string;
  name: string;
  searchTerms: string[];
  adLibraryUrls: string[];
  country: string;
  mediaType: string;
  batchStatus: SocialListeningStatus | null;
  errorMessage: string | null;
  collectedAt: string | null;
  aiSummary: string | null;
  aiInsights: AdLibraryAiInsights | null;
  ads: AdLibraryAdRow[];
  harvestableImageCount: number;
  isDemo: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  COLLECTING: "Mengumpulkan",
  READY: "Siap",
  FAILED: "Gagal",
};

const SORT_BY_ITEMS: SelectItemDef[] = [
  { value: "winning", label: "Winning score" },
  { value: "newest", label: "Terbaru" },
  { value: "longest", label: "Tayang terlama" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Pill status batch tinted untuk header detail. */
function StatusPill({ status }: { status: SocialListeningStatus | null }) {
  const running =
    status === "COLLECTING" || status === "ANALYZING" || status === "PENDING";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        status === "READY" &&
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        status === "FAILED" &&
          "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        running && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        status == null && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "READY" && "bg-emerald-500",
          status === "FAILED" && "bg-rose-500",
          running && "bg-amber-500 animate-pulse motion-reduce:animate-none",
          status == null && "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      {status ? STATUS_LABEL[status] ?? status : "Belum scrape"}
    </span>
  );
}

export function BrandAdLibraryDetailClient({ data }: { data: AdLibraryDetailData }) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
  const [pending, startTransition] = useTransition();
  const [ctaFilter, setCtaFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"winning" | "newest" | "longest">("winning");

  const hasKeywordSearch = data.searchTerms.length > 0;

  const inProgress =
    data.batchStatus === "COLLECTING" || data.batchStatus === "PENDING";

  useBrandJobProgress({ inProgress });

  const imageCount = useMemo(
    () => data.ads.filter((ad) => !isAdVideo(ad)).length,
    [data.ads],
  );

  const ctaTypes = useMemo(() => {
    const set = new Set<string>();
    for (const ad of data.ads) {
      if (ad.ctaType) set.add(ad.ctaType);
    }
    return [...set].sort();
  }, [data.ads]);

  const ctaFilterItems = useMemo<SelectItemDef[]>(
    () => [
      { value: "all", label: "Semua CTA" },
      ...ctaTypes.map((c) => ({ value: c, label: c })),
    ],
    [ctaTypes],
  );

  const filteredAds = useMemo(() => {
    const filtered = data.ads.filter((ad) => {
      if (ctaFilter !== "all" && ad.ctaType !== ctaFilter) return false;
      return true;
    });
    const days = (ad: AdLibraryAdRow) =>
      adDaysRunning(ad.deliveryStart, ad.deliveryStop) ?? -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "newest") {
        return (
          new Date(b.deliveryStart ?? 0).getTime() -
          new Date(a.deliveryStart ?? 0).getTime()
        );
      }
      if (sortBy === "longest") return days(b) - days(a);
      return (b.winningScore ?? -1) - (a.winningScore ?? -1); // winning
    });
  }, [data.ads, ctaFilter, sortBy]);

  const activeCount = data.ads.filter((a) => a.isActive).length;
  const videoCount = data.ads.filter((a) => isAdVideo(a)).length;
  const hotCount = data.ads.filter(
    (a) => a.winningScore != null && winningTierFromScore(a.winningScore) === "hot",
  ).length;

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshBrandAdLibraryMonitor(data.id);
        toast.success("Refresh dijadwalkan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      }
    });
  }

  function handleHarvest() {
    startTransition(async () => {
      try {
        const result = await harvestAdLibraryVisualsAction(data.id, brandId);
        toast.success(`${result.harvested} kreatif ditambahkan ke Visual Library.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal harvest visual."));
      }
    });
  }

  function handleRegenerateAi() {
    startTransition(async () => {
      try {
        await regenerateBrandAdLibraryAiSummary(data.id);
        toast.success("Ringkasan AI diperbarui.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal generate ringkasan AI."));
      }
    });
  }

  const subtitle =
    data.searchTerms.join(", ") ||
    data.adLibraryUrls[0] ||
    `Negara: ${data.country}`;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Link
        href={brandHubHref("/brand-hub/ad-library", brandId)}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs font-medium transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Kembali ke Ad Library
      </Link>

      <LabPageHeader
        variant="detail"
        icon={Megaphone}
        eyebrow="Ad Library"
        title={data.name}
        description={subtitle}
        right={
          <>
            <StatusPill status={data.batchStatus} />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={pending || inProgress}
              onClick={handleRefresh}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={pending || data.harvestableImageCount === 0}
              onClick={handleHarvest}
            >
              <ImageIcon className="size-3.5" />
              Harvest Visual
            </Button>
          </>
        }
      />

      {data.isDemo ? <DemoDataBanner context="Meta Ad Library." /> : null}

      {/* Papan hero bento */}
      {data.ads.length > 0 ? (
        <div
          className={cn(
            lab.entrance,
            "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
          )}
        >
          {/* Hero pink — total iklan */}
          <div className="bento-tile row-span-2 border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
            <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
              Total iklan
            </span>
            <span className="bento-value text-5xl text-white dark:text-pink-950">
              {data.ads.length.toLocaleString("id-ID")}
            </span>
            <span className="text-xs font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
              {imageCount.toLocaleString("id-ID")} image ·{" "}
              {videoCount.toLocaleString("id-ID")} video · negara {data.country}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Iklan aktif</span>
            <span className="bento-value">
              {activeCount}
              <span className="text-muted-foreground/60 text-lg font-bold">
                /{data.ads.length}
              </span>
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Winning &ldquo;hot&rdquo;</span>
            <span className="bento-value">{hotCount}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              tayang lama + di-scale
            </span>
          </div>

          {/* Visual siap harvest — pastel pink */}
          <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
            <span className="text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
              Visual siap harvest
            </span>
            <span className="bento-value text-pink-900 dark:text-pink-300">
              {data.harvestableImageCount.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-pink-800/60 dark:text-pink-200/50">
              ke Visual Library
            </span>
          </div>

          {/* Format scrape + update terakhir — amber pastel strip */}
          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Format scrape
            </span>
            <span className="bento-value text-2xl text-amber-900 dark:text-amber-300">
              {scrapeMediaTypeLabel(data.mediaType)}
            </span>
            <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-200/50">
              update terakhir {formatDate(data.collectedAt)}
            </span>
          </div>
        </div>
      ) : null}

      {inProgress ? (
        <JobProgressBar
          title="Mengumpulkan iklan Meta"
          percent={35}
          stepLabel="Scrape Ad Library via Apify — halaman diperbarui otomatis."
        />
      ) : null}

      {data.errorMessage && data.batchStatus === "FAILED" ? (
        <p
          className={cn(
            lab.nestedPanel,
            "text-rose-800 dark:text-rose-200 text-sm",
          )}
          role="alert"
        >
          {data.errorMessage}
        </p>
      ) : null}

      {hasKeywordSearch ? (
        <div className={cn(lab.nestedPanel, "text-muted-foreground text-sm leading-relaxed")}>
          Hanya iklan yang menyebut keyword{" "}
          <span className="text-foreground font-medium">
            {data.searchTerms.join(", ")}
          </span>{" "}
          di teks/hook iklan yang ditampilkan. Konten dewasa/NSFW difilter berdasarkan
          teks &amp; URL saja (gambar/video tidak dipindai — materi sensitif bisa lolos).
          Klik <span className="text-foreground font-medium">Refresh</span> untuk
          mengganti data lama dengan hasil scrape yang sudah difilter.
        </div>
      ) : null}

      {(data.aiSummary || data.aiInsights) && data.ads.length > 0 ? (
        <section className={cn(lab.entrance, "bento-tile justify-start gap-4")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="bento-label">Insight kreatif AI</p>
              <p className="text-muted-foreground text-xs">
                Pola hook, format, dan CTA dominan dari sample iklan.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              disabled={pending}
              onClick={handleRegenerateAi}
            >
              <Sparkles className="size-3.5" />
              Regenerate
            </Button>
          </div>
          {data.aiSummary ? (
            <p className="text-sm leading-relaxed">{data.aiSummary}</p>
          ) : null}
          {data.aiInsights ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.aiInsights.dominantFormats?.length ? (
                <div>
                  <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wide">
                    Format dominan
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.aiInsights.dominantFormats.map((f) => (
                      <Badge key={f} variant="secondary">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {data.aiInsights.dominantCtas?.length ? (
                <div>
                  <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wide">
                    CTA dominan
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.aiInsights.dominantCtas.map((c) => (
                      <Badge key={c} variant="outline">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {data.aiInsights.hookPatterns?.length ? (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wide">
                    Pola hook
                  </p>
                  <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                    {data.aiInsights.hookPatterns.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.aiInsights.creativeRecommendations?.length ? (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wide">
                    Rekomendasi kreatif
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {data.aiInsights.creativeRecommendations.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <LabSection
        title="Galeri Iklan"
        description={
          filteredAds.length === data.ads.length
            ? `${data.ads.length} iklan`
            : `${filteredAds.length} dari ${data.ads.length} iklan`
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Select
              value={sortBy}
              items={SORT_BY_ITEMS}
              onValueChange={(v) =>
                setSortBy((v as "winning" | "newest" | "longest") ?? "winning")
              }
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="winning">Winning score</SelectItem>
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="longest">Tayang terlama</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={ctaFilter}
              items={ctaFilterItems}
              onValueChange={(v) => setCtaFilter(v ?? "all")}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="CTA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua CTA</SelectItem>
                {ctaTypes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {filteredAds.length === 0 ? (
          <div className="bento-tile text-muted-foreground items-center justify-center p-8 text-center text-sm">
            {data.ads.length === 0
              ? "Belum ada iklan — klik Refresh untuk scrape."
              : "Tidak ada iklan yang cocok dengan filter."}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAds.map((ad) => {
              const tier =
                ad.winningScore != null ? winningTierFromScore(ad.winningScore) : null;
              const days = adDaysRunning(ad.deliveryStart, ad.deliveryStop);
              return (
                <Link
                  key={ad.id}
                  href={brandHubHref(
                    `/brand-hub/ad-library/${data.id}/ad/${ad.id}`,
                    brandId,
                  )}
                  className={galleryTileClass}
                >
                  <div className="bg-muted relative aspect-[4/5] w-full overflow-hidden">
                    <AdCreativeMedia
                      ad={ad}
                      alt={ad.pageName ?? "Ad creative"}
                      className="absolute inset-0"
                    />
                    {tier ? (
                      <Badge
                        className={cn(
                          "absolute top-2 left-2 z-10 text-[10px]",
                          TIER_BADGE_CLASS[tier],
                        )}
                      >
                        {AD_WINNING_TIER_LABEL[tier]} · {ad.winningScore}
                      </Badge>
                    ) : ad.mediaType ? (
                      <Badge
                        className="absolute top-2 left-2 z-10 text-[10px]"
                        variant="secondary"
                      >
                        {ad.mediaType}
                      </Badge>
                    ) : null}
                    {isAdVideo(ad) ? (
                      <Badge
                        className="absolute top-2 right-2 z-10 bg-black/60 text-[10px] text-white"
                        variant="secondary"
                      >
                        Video
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3.5">
                    <p className="truncate text-xs font-bold tracking-tight">
                      {ad.pageName ?? "—"}
                    </p>
                    {ad.bodyText ? (
                      <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
                        {ad.bodyText}
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap items-center gap-1.5">
                      {ad.ctaText || ad.ctaType ? (
                        <Badge variant="outline" className="text-[10px]">
                          {ad.ctaText ?? ad.ctaType}
                        </Badge>
                      ) : null}
                      {ad.isActive ? (
                        <Badge className="bg-emerald-500/15 text-[10px] text-emerald-700 dark:text-emerald-300">
                          Aktif
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-[10px]">
                      {days != null ? <span>Tayang {days} hari</span> : null}
                      {ad.collationCount != null && ad.collationCount > 1 ? (
                        <span>· {ad.collationCount} varian</span>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-[10px] tabular-nums">
                      {formatDate(ad.deliveryStart)}
                      {ad.deliveryStop ? ` – ${formatDate(ad.deliveryStop)}` : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </LabSection>
    </div>
  );
}
