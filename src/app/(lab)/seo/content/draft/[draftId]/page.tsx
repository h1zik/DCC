import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildScoreGrounding } from "@/lib/seo/content/generator";
import type { ScoreGrounding } from "@/lib/seo/content/content-score-v2";
import {
  ContentDraftEditor,
  type DraftDetail,
} from "./content-draft-editor";

export default async function SeoContentDraftPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await params;

  const draft = await prisma.seoContentDraft.findUnique({
    where: { id: draftId },
  });
  if (!draft) notFound();

  let grounding: ScoreGrounding | null = null;
  if (draft.briefId) {
    const brief = await prisma.seoContentBrief.findUnique({
      where: { id: draft.briefId },
    });
    if (brief) grounding = buildScoreGrounding(brief);
  }

  const detail: DraftDetail = {
    id: draft.id,
    title: draft.title,
    targetKeyword: draft.targetKeyword,
    contentHtml: draft.contentHtml,
    score: draft.score,
    analysis: (draft.analysis as DraftDetail["analysis"]) ?? null,
    briefId: draft.briefId,
    status: draft.status,
    stepLabel: draft.stepLabel,
    percent: draft.percent,
    errorMessage: draft.errorMessage,
    metaTitle: draft.metaTitle,
    metaDescription: draft.metaDescription,
    slug: draft.slug,
    internalLinks: Array.isArray(draft.internalLinks)
      ? (draft.internalLinks as DraftDetail["internalLinks"])
      : [],
  };

  return <ContentDraftEditor draft={detail} grounding={grounding} />;
}
