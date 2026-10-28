import { Bot } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureSeoPage } from "@/lib/seo/auth";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  AiVisibilityClient,
  type AiVisibilityRunRow,
} from "./ai-visibility-client";

/** Jumlah run terbaru yang dimuat ke daftar; tile "Total run" memakai count(). */
const RUN_LIST_LIMIT = 50;

export default async function SeoAiVisibilityPage() {
  await ensureSeoPage();

  const [runs, totalRuns] = await Promise.all([
    prisma.seoAiVisibilityRun.findMany({
      orderBy: { createdAt: "desc" },
      take: RUN_LIST_LIMIT,
    }),
    prisma.seoAiVisibilityRun.count(),
  ]);

  const items: AiVisibilityRunRow[] = runs.map((r) => ({
    id: r.id,
    name: r.name,
    brandTerms: r.brandTerms,
    keywords: r.keywords,
    platforms: r.platforms,
    status: r.status,
    results: Array.isArray(r.results)
      ? (r.results as AiVisibilityRunRow["results"])
      : [],
    summary:
      r.summary && typeof r.summary === "object" && !Array.isArray(r.summary)
        ? (r.summary as AiVisibilityRunRow["summary"])
        : null,
    dataNotice: r.dataNotice,
    errorMessage: r.errorMessage,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <SeoModulePage
      icon={Bot}
      title="AI Visibility"
      description="Apakah brand Anda disebut saat orang bertanya ke ChatGPT, Gemini, Claude, atau Perplexity? Frontier baru SEO (AEO) — pantau mention brand di jawaban AI untuk keyword komersial Anda."
    >
      <AiVisibilityClient items={items} totalRuns={totalRuns} />
    </SeoModulePage>
  );
}
