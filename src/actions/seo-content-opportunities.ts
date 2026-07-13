"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  SeoKeywordIntent,
  SeoOpportunityStage,
  SeoOpportunityType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { actionErrorMessage } from "@/lib/action-error-message";
import { refreshOpportunities } from "@/lib/seo/content/opportunity-feed";
import { generateContentBrief } from "@/lib/seo/content/generator";

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Refresh feed dari keyword project + rank tracker (background). */
export async function refreshOpportunitiesAction() {
  await requireSeoAccess();
  after(async () => {
    try {
      await refreshOpportunities();
    } catch (err) {
      console.error("[refreshOpportunitiesAction] gagal", err);
    }
  });
  revalidatePath("/seo/content/opportunities");
}

/** Buat brief (grounded) langsung dari satu opportunity — 1 klik. */
export async function createBriefFromOpportunity(opportunityId: string) {
  const session = await requireSeoAccess();
  z.string().min(1).parse(opportunityId);

  try {
    const opp = await prisma.seoContentOpportunity.findUnique({
      where: { id: opportunityId },
    });
    if (!opp) throw new Error("Opportunity tidak ditemukan.");
    if (opp.briefId) return { briefId: opp.briefId };

    const brief = await prisma.seoContentBrief.create({
      data: {
        targetKeyword: opp.keyword,
        title: opp.suggestedTitle ?? titleCase(opp.keyword),
        createdById: session.user.id,
      },
    });
    await prisma.seoContentOpportunity.update({
      where: { id: opp.id },
      data: { briefId: brief.id, stage: SeoOpportunityStage.BRIEFED },
    });

    after(async () => {
      try {
        await generateContentBrief(brief.id);
      } catch (err) {
        console.error("[createBriefFromOpportunity] pipeline gagal", err);
      }
    });

    revalidatePath("/seo/content/opportunities");
    revalidatePath("/seo/content");
    revalidatePath(`/seo/content/${brief.id}`);
    return { briefId: brief.id };
  } catch (err) {
    throw new Error(actionErrorMessage(err, "Gagal membuat brief."));
  }
}

const saveSuggestionSchema = z.object({
  keyword: z.string().min(1).max(200),
  suggestedTitle: z.string().max(200).optional(),
  angle: z.string().max(500).optional(),
  searchVolume: z.number().int().nullable().optional(),
  difficulty: z.number().int().nullable().optional(),
  intent: z.nativeEnum(SeoKeywordIntent).optional(),
  opportunityScore: z.number().min(0).max(100).optional(),
  sourceRefId: z.string().optional(),
});

/** Simpan satu saran Topic Discovery ke feed Opportunities. */
export async function saveTopicSuggestionToFeed(
  input: z.infer<typeof saveSuggestionSchema>,
) {
  await requireSeoAccess();
  const data = saveSuggestionSchema.parse(input);

  await prisma.seoContentOpportunity.upsert({
    where: { keyword: data.keyword.trim() },
    create: {
      keyword: data.keyword.trim(),
      type: SeoOpportunityType.NEW_ARTICLE,
      searchVolume: data.searchVolume ?? null,
      difficulty: data.difficulty ?? null,
      intent: data.intent ?? SeoKeywordIntent.UNKNOWN,
      opportunityScore: data.opportunityScore ?? 0,
      suggestedTitle: data.suggestedTitle?.trim() || null,
      angle: data.angle?.trim() || null,
      source: "topic_run",
      sourceRefId: data.sourceRefId ?? null,
    },
    update: {
      suggestedTitle: data.suggestedTitle?.trim() || undefined,
      angle: data.angle?.trim() || undefined,
      searchVolume: data.searchVolume ?? undefined,
      difficulty: data.difficulty ?? undefined,
      opportunityScore: data.opportunityScore ?? undefined,
    },
  });
  revalidatePath("/seo/content/opportunities");
}

export async function dismissOpportunity(opportunityId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(opportunityId);
  await prisma.seoContentOpportunity.update({
    where: { id: opportunityId },
    data: { stage: SeoOpportunityStage.DISMISSED },
  });
  revalidatePath("/seo/content/opportunities");
}

export async function restoreOpportunity(opportunityId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(opportunityId);
  await prisma.seoContentOpportunity.update({
    where: { id: opportunityId },
    data: { stage: SeoOpportunityStage.IDEA },
  });
  revalidatePath("/seo/content/opportunities");
}

const markPublishedSchema = z.object({
  opportunityId: z.string().min(1),
  url: z.string().url().max(500),
});

export async function markOpportunityPublished(
  input: z.infer<typeof markPublishedSchema>,
) {
  await requireSeoAccess();
  const data = markPublishedSchema.parse(input);
  await prisma.seoContentOpportunity.update({
    where: { id: data.opportunityId },
    data: {
      publishedUrl: data.url,
      stage: SeoOpportunityStage.PUBLISHED,
    },
  });
  revalidatePath("/seo/content/opportunities");
}
