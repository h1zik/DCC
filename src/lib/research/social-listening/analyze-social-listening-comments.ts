import "server-only";

import {
  SocialListeningStatus,
  type SocialMention,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  mergeResearchAiMeta,
  parseResearchAiMeta,
} from "@/lib/research/llm";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import { syncModuleRecommendations } from "@/lib/research/prescriptive/sync";
import type { ActionPlan } from "@/lib/research/prescriptive/types";
import { aggregateSocialSummary } from "@/lib/research/social-listening/aggregate-summary";
import { classifyComments } from "@/lib/research/social-listening/comment-analyzer";
import { collectPostComments } from "@/lib/research/social-listening/collect-post-comments";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import type { ClassifiedMention } from "@/lib/research/social-listening/mention-analyzer";
import { buildSocialActionPlanPrompt } from "@/lib/research/social-listening/prompts/mention-analysis";

function dbMentionToRaw(m: SocialMention): RawSocialMention {
  return {
    platform: m.platform,
    externalId: m.externalId ?? m.id,
    text: m.text,
    author: m.author ?? undefined,
    url: m.url ?? undefined,
    likes: m.likes,
    comments: m.comments,
    views: m.views,
    postedAt: m.postedAt ?? undefined,
    thumbnailUrl: m.thumbnailUrl ?? undefined,
    mediaType:
      m.mediaType === "video" || m.mediaType === "image"
        ? m.mediaType
        : undefined,
  };
}

function dbMentionToClassified(m: SocialMention): ClassifiedMention {
  return {
    platform: m.platform,
    externalId: m.externalId ?? m.id,
    text: m.text,
    author: m.author ?? undefined,
    url: m.url ?? undefined,
    likes: m.likes,
    comments: m.comments,
    views: m.views,
    postedAt: m.postedAt ?? undefined,
    thumbnailUrl: m.thumbnailUrl ?? undefined,
    mediaType:
      m.mediaType === "video" || m.mediaType === "image"
        ? m.mediaType
        : undefined,
    classification: m.classification,
    painPoint: m.painPoint,
    isViral: m.isViral,
  };
}

/** Scrape + klasifikasi komentar untuk batch yang sudah punya mention (on-demand). */
export async function analyzeSocialListeningComments(
  batchId: string,
): Promise<void> {
  const batch = await prisma.socialListeningBatch.findUnique({
    where: { id: batchId },
    include: {
      monitor: true,
      mentions: true,
      summary: true,
    },
  });

  if (!batch?.monitor) {
    throw new Error("Batch social listening tidak ditemukan.");
  }
  if (batch.mentions.length === 0) {
    throw new Error("Belum ada mention — refresh monitor dulu.");
  }
  if (
    batch.status !== SocialListeningStatus.READY &&
    batch.status !== SocialListeningStatus.ANALYZING
  ) {
    throw new Error("Batch belum siap untuk analisis komentar.");
  }

  const monitor = batch.monitor;
  const existingMeta = batch.summary?.aiMeta
    ? parseResearchAiMeta(batch.summary.aiMeta)
    : null;

  await prisma.socialListeningBatch.update({
    where: { id: batchId },
    data: { status: SocialListeningStatus.ANALYZING, errorMessage: null },
  });

  const warnings: string[] = [];
  const rawMentions = batch.mentions.map(dbMentionToRaw);
  const classifiedMentions = batch.mentions.map(dbMentionToClassified);

  try {
    const { comments: rawComments, warnings: scrapeWarnings } =
      await collectPostComments(rawMentions);
    warnings.push(...scrapeWarnings);

    const {
      classified: classifiedComments,
      commentAiSummary,
      aiMeta: commentMeta,
    } = await classifyComments({
      monitorName: monitor.name,
      keywords: monitor.keywords,
      comments: rawComments,
      existingMeta,
    });

    const summary = aggregateSocialSummary(
      classifiedMentions,
      classifiedComments,
    );

    let aiMeta = commentMeta ?? existingMeta;
    let actionPlan: ActionPlan | null = batch.summary?.aiActionPlan
      ? coerceActionPlan(batch.summary.aiActionPlan, `social-${batchId}`)
      : null;

    if (
      summary.topPainPoints.length > 0 ||
      summary.topWishlist.length > 0 ||
      summary.topCommentPainPoints.length > 0 ||
      summary.topCommentWishlist.length > 0
    ) {
      try {
        const planResult = await generateResearchJson<{ actionPlan?: unknown }>(
          buildSocialActionPlanPrompt({
            monitorName: monitor.name,
            painPoints: summary.topPainPoints,
            wishlist: summary.topWishlist,
            categoryBreakdown: summary.categoryBreakdown,
            commentPainPoints: summary.topCommentPainPoints,
            commentWishlist: summary.topCommentWishlist,
            commentAiSummary,
          }),
          { tier: "pro" },
        );
        actionPlan = coerceActionPlan(planResult.actionPlan, `social-${batchId}`);
        aiMeta = mergeResearchAiMeta(
          aiMeta ?? { steps: [] },
          buildResearchAiStep("Rencana aksi sosial", "pro"),
        );
      } catch (err) {
        console.error("[social-comments] action plan gagal", err);
      }
    }

    if (rawComments.length > 0) {
      warnings.unshift(`${rawComments.length} komentar teks terkumpul untuk analisis`);
    }

    const mentionIdByExternal = new Map(
      batch.mentions.map((m) => [`${m.platform}:${m.externalId}`, m.id]),
    );

    await prisma.$transaction(async (tx) => {
      await tx.socialComment.deleteMany({ where: { batchId } });

      if (classifiedComments.length > 0) {
        await tx.socialComment.createMany({
          data: classifiedComments.map((c) => ({
            batchId,
            mentionId:
              mentionIdByExternal.get(`${c.platform}:${c.parentExternalId}`) ??
              null,
            platform: c.platform,
            externalId: c.externalId,
            text: c.text,
            author: c.author ?? null,
            likes: c.likes,
            classification: c.classification,
            painPoint: c.painPoint,
            postedAt: c.postedAt ?? null,
          })),
          skipDuplicates: true,
        });
      }

      const baseSummary = batch.summary?.aiSummary ?? "";
      const commentNote = commentAiSummary ? ` ${commentAiSummary}` : "";
      const notice =
        warnings.length > 0 ? ` (${warnings.join(" ")})` : "";

      await tx.socialListeningSummary.upsert({
        where: { batchId },
        create: {
          batchId,
          topPainPoints: summary.topPainPoints,
          topWishlist: summary.topWishlist,
          influencers: summary.influencers,
          viralContent: summary.viralContent,
          categoryBreakdown: summary.categoryBreakdown,
          sentimentTimeline: summary.sentimentTimeline,
          topCommentPainPoints: summary.topCommentPainPoints,
          topCommentWishlist: summary.topCommentWishlist,
          commentCategoryBreakdown: summary.commentCategoryBreakdown,
          commentAiSummary,
          engagementInsights: summary.engagementInsights,
          aiActionPlan: actionPlan ?? undefined,
          aiSummary: `${baseSummary}${commentNote}${notice}`.trim(),
          aiMeta:
            aiMeta && aiMeta.steps.length > 0 ? (aiMeta as object) : undefined,
        },
        update: {
          topCommentPainPoints: summary.topCommentPainPoints,
          topCommentWishlist: summary.topCommentWishlist,
          commentCategoryBreakdown: summary.commentCategoryBreakdown,
          commentAiSummary,
          engagementInsights: summary.engagementInsights,
          aiActionPlan: actionPlan ?? undefined,
          aiSummary: `${baseSummary}${commentNote}${notice}`.trim(),
          aiMeta:
            aiMeta && aiMeta.steps.length > 0 ? (aiMeta as object) : undefined,
        },
      });

      await tx.socialListeningBatch.update({
        where: { id: batchId },
        data: {
          status: SocialListeningStatus.READY,
          errorMessage: warnings.length > 0 ? warnings.join(" | ") : null,
        },
      });
    });

    await syncModuleRecommendations({
      module: "social-listening",
      sourceId: monitor.id,
      sourceLabel: `Social: ${monitor.name}`,
      href: `/research-hub/social-listening/${monitor.id}`,
      plan: actionPlan,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Analisis komentar gagal.";
    await prisma.socialListeningBatch.update({
      where: { id: batchId },
      data: {
        status: SocialListeningStatus.READY,
        errorMessage: message,
      },
    });
    throw err;
  }
}

export async function resolveCommentAnalysisBatchId(
  monitorId: string,
): Promise<string> {
  const batch = await prisma.socialListeningBatch.findFirst({
    where: {
      monitorId,
      status: SocialListeningStatus.READY,
      mentions: { some: {} },
    },
    orderBy: { collectedAt: "desc" },
    select: { id: true },
  });
  if (!batch) {
    throw new Error(
      "Tidak ada batch siap dengan mention. Refresh monitor terlebih dahulu.",
    );
  }
  return batch.id;
}
