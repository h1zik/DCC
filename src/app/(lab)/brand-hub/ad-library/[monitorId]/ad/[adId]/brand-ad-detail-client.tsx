"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Layers,
  Megaphone,
  ThumbsUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LabPageHeader, lab } from "@/components/lab/lab-primitives";
import { AdCreativeMedia } from "@/components/brand-hub/ad-creative-media";
import { DemoDataBanner } from "@/components/brand-hub/demo-data-banner";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import {
  AD_WINNING_TIER_LABEL,
  type AdWinningTier,
} from "@/lib/brand-research/ad-winning-score";
import { cn } from "@/lib/utils";

export type AdDetailCard = {
  imageUrl: string | null;
  videoUrl: string | null;
  title: string | null;
  body: string | null;
  linkUrl: string | null;
};

export type AdDetailData = {
  monitorId: string;
  monitorName: string;
  pageName: string | null;
  pageProfileUrl: string | null;
  pageLikeCount: number | null;
  pageCategories: string[];
  pageCreationDate: string | null;
  totalActiveAds: number | null;
  bodyText: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  linkCaption: string | null;
  linkUrl: string | null;
  ctaType: string | null;
  ctaText: string | null;
  mediaType: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  snapshotUrl: string | null;
  platforms: string[];
  isActive: boolean;
  deliveryStart: string | null;
  deliveryStop: string | null;
  daysRunning: number | null;
  collationCount: number | null;
  audienceLower: number | null;
  audienceUpper: number | null;
  spendLower: number | null;
  spendUpper: number | null;
  currency: string | null;
  cards: AdDetailCard[];
  winningScore: number;
  winningTier: AdWinningTier;
  winningReasons: string[];
  isDemo: boolean;
};

const TIER_PILL_CLASS: Record<AdWinningTier, string> = {
  hot: "bg-red-500/15 text-red-600 dark:text-red-400",
  strong: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  testing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  new: "bg-muted text-muted-foreground",
};

function num(value: number | null): string {
  return value == null ? "—" : value.toLocaleString("id-ID");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function rangeText(
  lower: number | null,
  upper: number | null,
  currency?: string | null,
): string {
  if (lower == null && upper == null) return "Tidak diekspos Meta";
  const prefix = currency ? `${currency} ` : "";
  if (lower != null && upper != null) return `${prefix}${num(lower)}–${num(upper)}`;
  return `${prefix}${num(upper ?? lower)}`;
}

function DetailRow({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function BrandAdDetailClient({ data }: { data: AdDetailData }) {
  const brandId = useBrandHubBrandId();
  const carousel = data.cards.filter((c) => c.imageUrl || c.videoUrl);
  const hasCarousel = carousel.length > 1;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Link
        href={brandHubHref(`/brand-hub/ad-library/${data.monitorId}`, brandId)}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs font-medium transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {data.monitorName}
      </Link>

      <LabPageHeader
        variant="detail"
        icon={Megaphone}
        eyebrow="Detail iklan"
        title={data.pageName ?? "Iklan"}
        description={data.linkTitle ?? undefined}
        right={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              TIER_PILL_CLASS[data.winningTier],
            )}
          >
            {AD_WINNING_TIER_LABEL[data.winningTier]} · {data.winningScore}
          </span>
        }
      />

      {data.isDemo ? <DemoDataBanner context="Meta Ad Library." /> : null}

      {/* Papan hero bento */}
      <div
        className={cn(
          lab.entrance,
          "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
        )}
      >
        {/* Hero pink — winning score */}
        <div className="bento-tile row-span-2 border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
          <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
            Winning score
          </span>
          <span className="bento-value text-5xl text-white dark:text-pink-950">
            {data.winningScore}
          </span>
          <span className="text-xs font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
            tier {AD_WINNING_TIER_LABEL[data.winningTier]} — dari lama tayang,
            varian, dan status aktif
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Lama tayang</span>
          <span className="bento-value">
            {data.daysRunning != null ? data.daysRunning : "—"}
            {data.daysRunning != null ? (
              <span className="text-muted-foreground/60 text-lg font-bold">
                {" "}
                hari
              </span>
            ) : null}
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Varian kreatif</span>
          <span className="bento-value">{num(data.collationCount)}</span>
        </div>

        {/* Status — emerald saat aktif, netral saat berhenti */}
        <div
          className={cn(
            "bento-tile",
            data.isActive && "border-transparent bg-[#fde7f1] dark:bg-pink-400/10",
          )}
        >
          <span
            className={cn(
              "text-[11.5px] font-semibold",
              data.isActive
                ? "text-pink-800/70 dark:text-pink-200/60"
                : "text-muted-foreground",
            )}
          >
            Status
          </span>
          <span
            className={cn(
              "bento-value text-2xl",
              data.isActive && "text-pink-900 dark:text-pink-300",
            )}
          >
            {data.isActive ? "Aktif" : "Berhenti"}
          </span>
          <span
            className={cn(
              "text-[11px] font-medium",
              data.isActive
                ? "text-pink-800/60 dark:text-pink-200/50"
                : "text-muted-foreground",
            )}
          >
            {formatDate(data.deliveryStart)}
            {data.deliveryStop ? ` – ${formatDate(data.deliveryStop)}` : " – sekarang"}
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Platform</span>
          <span className="bento-value">{data.platforms.length}</span>
          <span className="text-muted-foreground truncate text-[11px] font-medium">
            {data.platforms.length ? data.platforms.join(", ") : "—"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Media */}
        <div className="flex flex-col gap-3">
          <div className="bg-muted border-border/70 relative aspect-[4/5] w-full overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgb(30_25_15/0.05)]">
            <AdCreativeMedia
              ad={{
                imageUrl: data.imageUrl,
                videoUrl: data.videoUrl,
                snapshotUrl: data.snapshotUrl,
                mediaType: data.mediaType,
              }}
              alt={data.pageName ?? "Ad creative"}
              className="absolute inset-0"
            />
          </div>

          {hasCarousel ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {carousel.map((card, i) => (
                <div
                  key={i}
                  className="bg-muted border-border/60 relative aspect-square w-24 shrink-0 overflow-hidden rounded-xl border"
                >
                  <AdCreativeMedia
                    ad={{
                      imageUrl: card.imageUrl,
                      videoUrl: card.videoUrl,
                      snapshotUrl: null,
                      mediaType: card.videoUrl ? "VIDEO" : "IMAGE",
                    }}
                    alt={card.title ?? `Kartu ${i + 1}`}
                    className="absolute inset-0"
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {data.snapshotUrl ? (
              <a
                href={data.snapshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
              >
                <ExternalLink className="size-3.5" />
                Lihat di Meta Ad Library
              </a>
            ) : null}
            {data.linkUrl ? (
              <a
                href={data.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
              >
                <ExternalLink className="size-3.5" />
                Landing page
              </a>
            ) : null}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-3">
          {/* Winning breakdown */}
          <section className="bento-tile justify-start gap-3">
            <div>
              <p className="bento-label">Kenapa skornya segini?</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Skor menimbang lama tayang (sinyal terkuat — brand mematikan iklan
                rugi dengan cepat), jumlah varian kreatif (scaling), status aktif,
                dan reach bila Meta mengeksposnya.
              </p>
            </div>
            {data.winningReasons.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {data.winningReasons.map((r) => (
                  <Badge key={r} variant="outline" className="text-[11px]">
                    {r}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Belum ada sinyal kuat — iklan masih baru / belum di-scale.
              </p>
            )}
          </section>

          {/* Body copy */}
          {data.bodyText ? (
            <section className="bento-tile justify-start gap-3">
              <p className="bento-label">Teks iklan</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {data.bodyText}
              </p>
            </section>
          ) : null}

          {/* Link & CTA */}
          <section className="bento-tile justify-start gap-2">
            <p className="bento-label">Link & CTA</p>
            <div>
              {data.linkTitle ? <DetailRow label="Headline" value={data.linkTitle} /> : null}
              {data.linkDescription ? (
                <DetailRow label="Deskripsi" value={data.linkDescription} />
              ) : null}
              {data.linkCaption ? (
                <DetailRow label="Caption / URL" value={data.linkCaption} />
              ) : null}
              <DetailRow
                label="CTA"
                value={data.ctaText || data.ctaType || "—"}
              />
            </div>
          </section>

          {/* Metrik & delivery */}
          <section className="bento-tile justify-start gap-2">
            <p className="bento-label">Delivery & metrik</p>
            <div>
              <DetailRow
                label="Tayang"
                value={`${formatDate(data.deliveryStart)} – ${data.deliveryStop ? formatDate(data.deliveryStop) : "sekarang"}`}
              />
              <DetailRow
                label="Lama tayang"
                value={data.daysRunning != null ? `${data.daysRunning} hari` : "—"}
              />
              <DetailRow
                label="Varian kreatif"
                value={num(data.collationCount)}
              />
              <DetailRow
                label="Platform"
                value={data.platforms.length ? data.platforms.join(", ") : "—"}
              />
              <DetailRow label="Format" value={data.mediaType ?? "—"} />
              <DetailRow
                label="Estimasi audiens"
                value={rangeText(data.audienceLower, data.audienceUpper)}
              />
              <DetailRow
                label="Spend"
                value={rangeText(data.spendLower, data.spendUpper, data.currency)}
              />
            </div>
          </section>

          {/* Advertiser */}
          <section className="bento-tile justify-start gap-2">
            <p className="bento-label">Pengiklan</p>
            <div>
              <DetailRow
                label="Halaman"
                value={
                  data.pageProfileUrl ? (
                    <a
                      href={data.pageProfileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      {data.pageName ?? "—"}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    data.pageName ?? "—"
                  )
                }
              />
              <DetailRow
                label={
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="size-3" /> Likes
                  </span>
                }
                value={num(data.pageLikeCount)}
              />
              <DetailRow
                label={
                  <span className="inline-flex items-center gap-1">
                    <Layers className="size-3" /> Iklan aktif halaman
                  </span>
                }
                value={num(data.totalActiveAds)}
              />
              <DetailRow
                label={
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3" /> Halaman dibuat
                  </span>
                }
                value={data.pageCreationDate ?? "—"}
              />
              {data.pageCategories.length > 0 ? (
                <DetailRow
                  label={
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" /> Kategori
                    </span>
                  }
                  value={data.pageCategories.join(", ")}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
