import { prisma } from "@/lib/prisma";
import { ensureSeoPage } from "@/lib/seo/auth";
import {
  OpportunitiesClient,
  type OpportunityRow,
} from "./opportunities-client";

export default async function SeoContentOpportunitiesPage() {
  await ensureSeoPage();

  const rows = await prisma.seoContentOpportunity.findMany({
    orderBy: { opportunityScore: "desc" },
    include: {
      brief: {
        select: {
          id: true,
          drafts: { select: { id: true }, take: 1, orderBy: { updatedAt: "desc" } },
        },
      },
    },
  });

  const items: OpportunityRow[] = rows.map((r) => ({
    id: r.id,
    keyword: r.keyword,
    type: r.type,
    stage: r.stage,
    searchVolume: r.searchVolume,
    difficulty: r.difficulty,
    intent: r.intent,
    opportunityScore: r.opportunityScore,
    clusterLabel: r.clusterLabel,
    currentPosition: r.currentPosition,
    targetUrl: r.targetUrl,
    suggestedTitle: r.suggestedTitle,
    angle: r.angle,
    publishedUrl: r.publishedUrl,
    briefId: r.briefId,
    draftId: r.brief?.drafts[0]?.id ?? null,
    lastRefreshedAt: r.lastRefreshedAt.toISOString(),
  }));

  return <OpportunitiesClient items={items} />;
}
