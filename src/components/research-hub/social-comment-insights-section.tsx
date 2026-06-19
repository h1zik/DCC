"use client";

import { SentimentBreakdownDonut } from "@/components/research-hub/social-insight-charts";
import { SocialPainPointsList } from "@/components/research-hub/social-pain-points-list";
import { SocialWishlistList } from "@/components/research-hub/social-wishlist-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="space-y-4">
      {commentAiSummary ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Insight Komentar (AI)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {commentAiSummary}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pain Points dari Komentar</CardTitle>
          </CardHeader>
          <CardContent>
            <SocialPainPointsList items={topCommentPainPoints} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Wishlist dari Komentar</CardTitle>
          </CardHeader>
          <CardContent>
            <SocialWishlistList items={topCommentWishlist} />
          </CardContent>
        </Card>
        {commentCategoryBreakdown.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sentimen Komentar</CardTitle>
            </CardHeader>
            <CardContent>
              <SentimentBreakdownDonut data={commentCategoryBreakdown} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
