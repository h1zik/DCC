import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureContentStudioPage } from "@/lib/content-studio/auth";
import { IdeaSetDetailClient } from "./idea-set-detail-client";

export default async function ContentIdeaSetPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  await ensureContentStudioPage();
  const { setId } = await params;

  const set = await prisma.contentStudioIdeaSet.findUnique({
    where: { id: setId },
    include: {
      ownerBrand: { select: { name: true } },
      ideas: true,
    },
  });
  if (!set) notFound();

  const ideas = [...set.ideas].sort(
    (a, b) => (b.score ?? -1) - (a.score ?? -1),
  );

  return (
    <IdeaSetDetailClient
      set={{
        id: set.id,
        name: set.name,
        topic: set.topic,
        goal: set.goal,
        status: set.status,
        platforms: set.platforms,
        groundingSources: set.groundingSources,
        dataNotice: set.dataNotice,
        aiSummary: set.aiSummary,
        errorMessage: set.errorMessage,
        brandName: set.ownerBrand?.name ?? null,
      }}
      ideas={ideas.map((i) => ({
        id: i.id,
        title: i.title,
        angle: i.angle,
        format: i.format,
        hook: i.hook,
        platform: i.platform,
        cta: i.cta,
        score: i.score,
        feedback: i.feedback,
        used: i.used,
        citations: Array.isArray(i.citations)
          ? (i.citations as { source?: string; text?: string }[])
              .filter((c) => c && typeof c.text === "string")
              .map((c) => ({ source: c.source ?? "topic", text: c.text as string }))
          : [],
      }))}
    />
  );
}
