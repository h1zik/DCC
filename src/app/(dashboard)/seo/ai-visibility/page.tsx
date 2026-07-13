import { Bot } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureSeoPage } from "@/lib/seo/auth";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  AiVisibilityClient,
  type AiVisibilityRunRow,
} from "./ai-visibility-client";

export default async function SeoAiVisibilityPage() {
  await ensureSeoPage();

  const runs = await prisma.seoAiVisibilityRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });

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
  }));

  return (
    <SeoModulePage
      icon={Bot}
      title="AI Visibility"
      description="Apakah brand Anda disebut saat orang bertanya ke ChatGPT, Gemini, atau Perplexity? Frontier baru SEO (AEO) — pantau mention brand di jawaban AI untuk keyword komersial Anda."
    >
      <AiVisibilityClient items={items} />
    </SeoModulePage>
  );
}
