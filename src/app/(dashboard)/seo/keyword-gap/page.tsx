import { Swords } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { KeywordGapClient, type KeywordGapRow } from "./keyword-gap-client";

export default async function SeoKeywordGapPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string; competitor?: string }>;
}) {
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
    const summary =
      r.summary && typeof r.summary === "object" && !Array.isArray(r.summary)
        ? (r.summary as { buckets?: { missing?: number; weak?: number } })
        : null;
    return {
      id: r.id,
      name: r.name,
      target: r.target,
      competitors: r.competitors,
      status: r.status,
      missing: summary?.buckets?.missing ?? null,
      weak: summary?.buckets?.weak ?? null,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return (
    <SeoModulePage
      icon={Swords}
      title="Keyword Gap"
      description="Bandingkan keyword organik domain Anda vs hingga 3 kompetitor — temukan keyword yang mereka ranking tapi Anda belum (missing/weak/untapped)."
    >
      <KeywordGapClient
        items={items}
        prefillTarget={target ?? ""}
        prefillCompetitor={competitor ?? ""}
      />
    </SeoModulePage>
  );
}
