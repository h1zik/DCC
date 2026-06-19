"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MessageSquareText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SocialCommentFeed, type CommentFeedRow } from "@/components/research-hub/social-comment-feed";
import { SocialCommentInsightsSection } from "@/components/research-hub/social-comment-insights-section";

type CommentInsights = {
  commentAiSummary: string | null;
  topCommentPainPoints: { theme: string; count: number }[];
  topCommentWishlist: { theme: string; count: number }[];
  commentCategoryBreakdown: { classification: string; count: number; pct: number }[];
};

export function SocialCommentAnalyzeSection({
  monitorId,
  batchStatus,
  hasMentions,
  comments,
  insights,
  onAnalyze,
}: {
  monitorId: string;
  batchStatus: string | null;
  hasMentions: boolean;
  comments: CommentFeedRow[];
  insights: CommentInsights;
  onAnalyze: (monitorId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const hasComments = comments.length > 0;
  const isAnalyzingComments =
    batchStatus === "ANALYZING" && hasMentions && !pending;
  const canAnalyze =
    hasMentions &&
    batchStatus === "READY" &&
    !pending &&
    !isAnalyzingComments;

  function handleAnalyze() {
    startTransition(async () => {
      try {
        await onAnalyze(monitorId);
        toast.success("Analisis komentar dimulai — bisa beberapa menit.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai analisis komentar."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {hasComments || insights.commentAiSummary ? (
        <SocialCommentInsightsSection
          commentAiSummary={insights.commentAiSummary}
          topCommentPainPoints={insights.topCommentPainPoints}
          topCommentWishlist={insights.topCommentWishlist}
          commentCategoryBreakdown={insights.commentCategoryBreakdown}
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Analisis Komentar</CardTitle>
          {canAnalyze ? (
            <Button size="sm" onClick={handleAnalyze} disabled={pending}>
              <MessageSquareText className="size-3.5" aria-hidden />
              Analisis Komentar
            </Button>
          ) : null}
          {hasComments && batchStatus === "READY" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAnalyze}
              disabled={pending || isAnalyzingComments}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Ulangi analisis
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isAnalyzingComments ? (
            <p className="text-muted-foreground text-sm">
              Mengambil komentar dari video teratas via Apify (TikTok/Instagram)…
              Halaman akan refresh otomatis.
            </p>
          ) : null}

          {!hasComments && !isAnalyzingComments ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Scrape mention sudah selesai. Klik{" "}
                <strong>Analisis Komentar</strong> untuk mengambil komentar dari
                video/post viral (actor terpisah — tidak memperlambat scrape
                awal).
              </p>
              {!hasMentions ? (
                <p className="text-muted-foreground text-sm">
                  Belum ada mention — refresh monitor dulu.
                </p>
              ) : null}
            </div>
          ) : null}

          {hasComments ? <SocialCommentFeed rows={comments} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
