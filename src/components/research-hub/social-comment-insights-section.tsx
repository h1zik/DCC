"use client";

import { SentimentBreakdownDonut } from "@/components/research-hub/social-insight-charts";
import { SocialPainPointsList } from "@/components/research-hub/social-pain-points-list";
import { SocialWishlistList } from "@/components/research-hub/social-wishlist-list";
import {
  hub,
  ResearchHubSection,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-col gap-6">
      {commentAiSummary ? (
        <ResearchHubSection title="Insight Komentar (AI)">
          <div className={cn(hub.panel, "text-muted-foreground text-sm leading-relaxed")}>
            {commentAiSummary}
          </div>
        </ResearchHubSection>
      ) : null}

      {hasComments ? (
        <ResearchHubSection
          title="Tema dari Komentar"
          description="Pain points, wishlist, dan sentimen dari teks komentar."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className={hub.panel}>
              <p className="mb-3 text-sm font-medium">Pain Points dari Komentar</p>
              <SocialPainPointsList items={topCommentPainPoints} />
            </div>
            <div className={hub.panel}>
              <p className="mb-3 text-sm font-medium">Wishlist dari Komentar</p>
              <SocialWishlistList items={topCommentWishlist} />
            </div>
            {commentCategoryBreakdown.length > 0 ? (
              <div className={cn(hub.panel, "flex min-h-[240px] flex-col")}>
                <p className="mb-3 text-sm font-medium">Sentimen Komentar</p>
                <div className="flex flex-1 items-center justify-center">
                  <SentimentBreakdownDonut data={commentCategoryBreakdown} />
                </div>
              </div>
            ) : null}
          </div>
        </ResearchHubSection>
      ) : null}
    </div>
  );
}
