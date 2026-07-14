import { Swords } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureSeoPage } from "@/lib/seo/auth";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { KeywordGapClient, type KeywordGapRow } from "./keyword-gap-client";

export default async function SeoKeywordGapPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string; competitor?: string }>;
}) {
  await ensureSeoPage();
  const { target, competitor } = await searchParams;

  const rows = await prisma.seoKeywordGap.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      target: true,
      competitors: true,
      status: true,
      summary: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  const items: KeywordGapRow[] = rows.map((r) => {
    const storedSummary =
      r.summary && typeof r.summary === "object" && !Array.isArray(r.summary)
        ? (r.summary as {
            version?: number;
            buckets?: { missing?: number; weak?: number };
          })
        : null;
    const summary = storedSummary?.version === 2 ? storedSummary : null;
    return {
      id: r.id,
      name: r.name,
      target: r.target,
      competitors: r.competitors,
      status: r.status,
      missing: summary?.buckets?.missing ?? null,
      weak: summary?.buckets?.weak ?? null,
      needsRefresh: storedSummary != null && storedSummary.version !== 2,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return (
    <SeoModulePage
      icon={Swords}
      title="Keyword Gap"
      description="Bandingkan keyword organik domain Anda vs hingga 3 kompetitor — temukan missing, weak, untapped, dan kekuatan unik domain Anda."
    >
      <KeywordGapClient
        items={items}
        prefillTarget={target ?? ""}
        prefillCompetitor={competitor ?? ""}
      />
    </SeoModulePage>
  );
}
