import { PenLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  ContentClient,
  type BriefRow,
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
  }));

  const draftRows: DraftRow[] = drafts.map((d) => ({
    id: d.id,
    title: d.title,
    targetKeyword: d.targetKeyword,
    score: d.score,
    updatedAt: d.updatedAt.toISOString(),
  }));

  return (
    <SeoModulePage
      icon={PenLine}
      title="Content SEO Optimizer"
      description="Dari keyword target → brief & outline → draft artikel (LLM, tone kosmetik, Bahasa Indonesia) → analisis keyword usage, readability, dan struktur dengan skor + saran."
    >
      <ContentClient briefs={briefRows} drafts={draftRows} />
    </SeoModulePage>
  );
}
