"use client";

import type { EngagementInsights } from "@/lib/research/social-listening/social-comment-types";
import { cn } from "@/lib/utils";

/** Tile mini bento untuk satu metrik engagement. */
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
    <div className="bg-muted/40 flex flex-col rounded-xl px-3.5 py-3">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-1 text-xl font-extrabold tabular-nums tracking-tight">
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground mt-0.5 text-[10px]">{hint}</p>
      ) : null}
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
    <div className={cn("grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4", className)}>
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
