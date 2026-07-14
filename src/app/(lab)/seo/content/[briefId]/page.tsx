import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ContentBriefClient,
  type BriefDetail,
} from "./content-brief-client";

export default async function SeoContentBriefPage({
  params,
}: {
  params: Promise<{ briefId: string }>;
}) {
  const { briefId } = await params;

  const brief = await prisma.seoContentBrief.findUnique({
    where: { id: briefId },
    include: {
      drafts: {
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, score: true },
      },
    },
  });
  if (!brief) notFound();

  const detail: BriefDetail = {
    id: brief.id,
    title: brief.title,
    targetKeyword: brief.targetKeyword,
    status: brief.status,
    angle: brief.aiSummary,
    relatedKeywords: Array.isArray(brief.relatedKeywords)
      ? (brief.relatedKeywords as string[])
      : [],
    outline: Array.isArray(brief.outline)
      ? (brief.outline as BriefDetail["outline"])
      : [],
    errorMessage: brief.errorMessage,
    dataNotice: brief.dataNotice,
    stepLabel: brief.stepLabel,
    percent: brief.percent,
    serpData: Array.isArray(brief.serpData)
      ? (brief.serpData as BriefDetail["serpData"])
      : [],
    paaQuestions: Array.isArray(brief.paaQuestions)
      ? (brief.paaQuestions as string[])
      : [],
    relatedSearches: Array.isArray(brief.relatedSearches)
      ? (brief.relatedSearches as string[])
      : [],
    competitors: Array.isArray(brief.competitors)
      ? (brief.competitors as BriefDetail["competitors"])
      : [],
    terms: Array.isArray(brief.terms) ? (brief.terms as BriefDetail["terms"]) : [],
    targetWordCount: brief.targetWordCount,
    targetHeadings: brief.targetHeadings,
    drafts: brief.drafts.map((d) => ({
      id: d.id,
      title: d.title,
      score: d.score,
    })),
  };

  return <ContentBriefClient brief={detail} />;
}
