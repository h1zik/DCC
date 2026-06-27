"use client";

import Link from "next/link";
import {
  CalendarDays,
  ExternalLink,
  Layers,
  Megaphone,
  ThumbsUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BrandHubPageHeader,
  BrandHubStatChip,
  hub,
} from "@/components/brand-hub/brand-hub-primitives";
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

const TIER_SCORE_CLASS: Record<AdWinningTier, string> = {
  hot: "text-red-600 dark:text-red-400",
  strong: "text-emerald-600 dark:text-emerald-400",
  testing: "text-amber-600 dark:text-amber-400",
  new: "text-muted-foreground",
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
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors"
      >
        <Megaphone className="size-3" aria-hidden />
        {data.monitorName}
      </Link>

      <BrandHubPageHeader
        eyebrow="Detail iklan"
        title={data.pageName ?? "Iklan"}
        description={data.linkTitle ?? undefined}
        right={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {AD_WINNING_TIER_LABEL[data.winningTier]}
            </Badge>
            <span
              className={cn(
                "text-2xl font-bold tabular-nums",
                TIER_SCORE_CLASS[data.winningTier],
              )}
            >
              {data.winningScore}
            </span>
          </div>
        }
      />

      {data.isDemo ? <DemoDataBanner context="Meta Ad Library." /> : null}

      <div className="flex flex-wrap gap-2">
        <BrandHubStatChip label="Winning score" value={data.winningScore} tone="primary" />
        <BrandHubStatChip
          label="Tayang"
          value={data.daysRunning != null ? `${data.daysRunning} hari` : "—"}
        />
        <BrandHubStatChip label="Varian kreatif" value={num(data.collationCount)} />
        <BrandHubStatChip
          label="Status"
          value={data.isActive ? "Aktif" : "Berhenti"}
          tone={data.isActive ? "success" : "neutral"}
        />
        <BrandHubStatChip label="Platform" value={data.platforms.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Media */}
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              hub.panel,
              "bg-muted relative aspect-[4/5] w-full overflow-hidden p-0",
            )}
          >
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
                  className="bg-muted relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg border border-border/50"
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
        <div className="flex flex-col gap-5">
          {/* Winning breakdown */}
          <div className={hub.panel}>
            <p className="mb-2 text-sm font-semibold">Kenapa skornya segini?</p>
            <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
              Skor menimbang lama tayang (sinyal terkuat — brand mematikan iklan
              rugi dengan cepat), jumlah varian kreatif (scaling), status aktif,
              dan reach bila Meta mengeksposnya.
            </p>
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
          </div>

          {/* Body copy */}
          {data.bodyText ? (
            <div className={cn(hub.card, "p-4")}>
              <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
                Teks iklan
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {data.bodyText}
              </p>
            </div>
          ) : null}

          {/* Link & CTA */}
          <div className={cn(hub.card, "p-4")}>
            <p className="mb-2 text-sm font-semibold">Link & CTA</p>
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

          {/* Metrik & delivery */}
          <div className={cn(hub.card, "p-4")}>
            <p className="mb-2 text-sm font-semibold">Delivery & metrik</p>
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

          {/* Advertiser */}
          <div className={cn(hub.card, "p-4")}>
            <p className="mb-2 text-sm font-semibold">Pengiklan</p>
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
        </div>
      </div>
    </div>
  );
}
