"use client";

import type { EngagementInsights } from "@/lib/research/social-listening/social-comment-types";
import { cn } from "@/lib/utils";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-muted-foreground mt-0.5 text-[10px]">{hint}</p> : null}
    </div>
  );
}

export function SocialEngagementInsights({
  insights,
  className,
}: {
  insights: EngagementInsights | null;
  className?: string;
}) {
  if (!insights || insights.totalMentions === 0) return null;

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      <Stat
        label="Rata-rata likes"
        value={insights.avgLikes.toLocaleString("id-ID")}
      />
      <Stat
        label="Rata-rata komentar"
        value={insights.avgComments.toLocaleString("id-ID")}
        hint={`${insights.totalCommentCount.toLocaleString("id-ID")} total`}
      />
      <Stat
        label="Komentar dianalisis"
        value={insights.scrapedCommentTexts.toLocaleString("id-ID")}
        hint="Teks komentar, bukan hanya angka"
      />
      <Stat
        label="Rasio komentar/likes"
        value={insights.commentToLikeRatio.toFixed(2)}
        hint={
          insights.highCommentPosts > 0
            ? `${insights.highCommentPosts} post ≥100 komentar`
            : undefined
        }
      />
    </div>
  );
}
