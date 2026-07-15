"use client";

import { SentimentBreakdownDonut } from "@/components/research-hub/social-insight-charts";
import { SocialPainPointsList } from "@/components/research-hub/social-pain-points-list";
import { SocialWishlistList } from "@/components/research-hub/social-wishlist-list";

export function SocialCommentInsightsSection({
  commentAiSummary,
  topCommentPainPoints,
  topCommentWishlist,
  commentCategoryBreakdown,
}: {
  commentAiSummary: string | null;
  topCommentPainPoints: { theme: string; count: number }[];
  topCommentWishlist: { theme: string; count: number }[];
  commentCategoryBreakdown: { classification: string; count: number; pct: number }[];
}) {
  const hasComments =
    topCommentPainPoints.length > 0 ||
    topCommentWishlist.length > 0 ||
    commentCategoryBreakdown.length > 0;

  if (!hasComments && !commentAiSummary) return null;

  return (
    <div className="flex flex-col gap-4">
      {commentAiSummary ? (
        <section className="bento-tile justify-start gap-3">
          <p className="bento-label">Insight komentar (AI)</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {commentAiSummary}
          </p>
        </section>
      ) : null}

      {hasComments ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <section className="bento-tile justify-start gap-3">
            <p className="bento-label">Pain points dari komentar</p>
            <SocialPainPointsList items={topCommentPainPoints} />
          </section>
          <section className="bento-tile justify-start gap-3">
            <p className="bento-label">Wishlist dari komentar</p>
            <SocialWishlistList items={topCommentWishlist} />
          </section>
          {commentCategoryBreakdown.length > 0 ? (
            <section className="bento-tile min-h-[260px] justify-start gap-3">
              <p className="bento-label">Sentimen komentar</p>
              <div className="flex flex-1 items-center justify-center">
                <SentimentBreakdownDonut data={commentCategoryBreakdown} />
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
