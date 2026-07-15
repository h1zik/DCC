import { PenLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  ContentClient,
  type BriefRow,
  type ContentSummary,
  type DraftRow,
} from "./content-client";

export default async function SeoContentPage() {
  const [briefs, drafts] = await Promise.all([
    prisma.seoContentBrief.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        targetKeyword: true,
        title: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        _count: { select: { drafts: true } },
      },
    }),
    prisma.seoContentDraft.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        targetKeyword: true,
        score: true,
        updatedAt: true,
      },
    }),
  ]);

  const briefRows: BriefRow[] = briefs.map((b) => ({
    id: b.id,
    targetKeyword: b.targetKeyword,
    title: b.title,
    status: b.status,
    errorMessage: b.errorMessage,
    createdAt: b.createdAt.toISOString(),
    draftCount: b._count.drafts,
  }));

  const draftRows: DraftRow[] = drafts.map((d) => ({
    id: d.id,
    title: d.title,
    targetKeyword: d.targetKeyword,
    score: d.score,
    updatedAt: d.updatedAt.toISOString(),
  }));

  const scoredDrafts = draftRows.filter((d) => d.score != null);
  const summary: ContentSummary = {
    totalBriefs: briefRows.length,
    readyBriefs: briefRows.filter((b) => b.status === "READY").length,
    busyBriefs: briefRows.filter((b) => isSeoStatusBusy(b.status)).length,
    totalDrafts: draftRows.length,
    avgDraftScore: scoredDrafts.length
      ? Math.round(
          scoredDrafts.reduce((acc, d) => acc + (d.score ?? 0), 0) /
            scoredDrafts.length,
        )
      : null,
    publishReadyDrafts: scoredDrafts.filter((d) => (d.score ?? 0) >= 80).length,
  };

  return (
    <SeoModulePage
      icon={PenLine}
      title="Content SEO Optimizer"
      description="Dari keyword target → brief & outline → draft artikel (LLM, tone kosmetik, Bahasa Indonesia) → analisis keyword usage, readability, dan struktur dengan skor + saran."
    >
      <ContentClient briefs={briefRows} drafts={draftRows} summary={summary} />
    </SeoModulePage>
  );
}
