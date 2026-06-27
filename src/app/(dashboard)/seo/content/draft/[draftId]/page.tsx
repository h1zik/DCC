import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  const detail: DraftDetail = {
    id: draft.id,
    title: draft.title,
    targetKeyword: draft.targetKeyword,
    contentHtml: draft.contentHtml,
    score: draft.score,
    analysis: (draft.analysis as DraftDetail["analysis"]) ?? null,
    briefId: draft.briefId,
  };

  return <ContentDraftEditor draft={detail} />;
}
