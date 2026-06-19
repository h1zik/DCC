import "server-only";

import { TrendRadarStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { researchAiMetaFromSteps } from "@/lib/research/llm";
import {
  clusteredTrendToDbFields,
  runTrendDigestPipeline,
  weekBounds,
} from "@/lib/research/trend-radar/generate-trend-digest-core";
import { syncModuleRecommendations } from "@/lib/research/prescriptive/sync";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";
import { getDefaultTrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config";

async function findPriorResearchDigest(input: {
  isGlobal: boolean;
  watchlistId?: string | null;
  weekStart: Date;
}) {
  return prisma.trendRadarDigest.findFirst({
    where: {
      isGlobal: input.isGlobal,
      watchlistId: input.watchlistId ?? null,
      status: TrendRadarStatus.READY,
      weekStart: { lt: input.weekStart },
    },
    orderBy: { weekStart: "desc" },
    include: {
      items: { select: { name: true, tmiScore: true, score: true } },
    },
  });
}

export async function generateTrendDigest(input: {
  digestId?: string;
  isGlobal: boolean;
  watchlistId?: string | null;
  seedKeywords?: string[];
  watchlistName?: string;
  sourceConfig?: TrendSourceConfig;
}): Promise<string> {
  const { weekStart, weekEnd } = weekBounds();
  const sourceConfig = input.sourceConfig ?? getDefaultTrendSourceConfig();

  let digestId = input.digestId;
  if (!digestId) {
    const digest = await prisma.trendRadarDigest.create({
      data: {
        weekStart,
        weekEnd,
        isGlobal: input.isGlobal,
        watchlistId: input.watchlistId ?? null,
        status: TrendRadarStatus.COLLECTING,
        sourceConfig: sourceConfig as object,
      },
    });
    digestId = digest.id;
  } else {
    await prisma.trendRadarDigest.update({
      where: { id: digestId },
      data: {
        status: TrendRadarStatus.COLLECTING,
        errorMessage: null,
        sourceConfig: sourceConfig as object,
      },
    });
    await prisma.trendRadarItem.deleteMany({ where: { digestId } });
  }

  try {
    const prior = await findPriorResearchDigest({
      isGlobal: input.isGlobal,
      watchlistId: input.watchlistId,
      weekStart,
    });

    await prisma.trendRadarDigest.update({
      where: { id: digestId },
      data: { status: TrendRadarStatus.ANALYZING },
    });

    const pipeline = await runTrendDigestPipeline({
      seedKeywords: input.seedKeywords,
      watchlistName: input.watchlistName,
      sourceConfig,
      priorDigestId: prior?.id ?? null,
      priorItems:
        prior?.items.map((i) => ({
          name: i.name,
          tmiScore: i.tmiScore ?? i.score,
        })) ?? [],
    });

    if (pipeline.failed) {
      await prisma.trendRadarDigest.update({
        where: { id: digestId },
        data: {
          status: TrendRadarStatus.FAILED,
          digestMode: pipeline.digestMode,
          signalStats: pipeline.signalStats as object,
          dataNotice: pipeline.dataNotice,
          priorDigestId: pipeline.priorDigestId,
          errorMessage: pipeline.dataNotice,
          generatedAt: new Date(),
        },
      });
      return digestId;
    }

    if (pipeline.items.length > 0) {
      await prisma.trendRadarItem.createMany({
        data: pipeline.items.map((item) => ({
          digestId: digestId!,
          ...clusteredTrendToDbFields(item),
        })),
      });
    }

    await prisma.trendRadarDigest.update({
      where: { id: digestId },
      data: {
        status: TrendRadarStatus.READY,
        digestMode: pipeline.digestMode,
        signalStats: pipeline.signalStats as object,
        dataNotice: pipeline.dataNotice,
        priorDigestId: pipeline.priorDigestId,
        narrative: pipeline.narrative,
        generatedAt: new Date(),
        weekStart,
        weekEnd,
        aiActionPlan: pipeline.actionPlan ?? undefined,
        aiMeta:
          pipeline.aiMetaSteps.length > 0
            ? (researchAiMetaFromSteps(pipeline.aiMetaSteps) as object)
            : undefined,
      },
    });

    if (input.isGlobal && pipeline.actionPlan) {
      await syncModuleRecommendations({
        module: "trend-radar",
        sourceId: digestId,
        sourceLabel: "Trend Radar (mingguan)",
        href: `/research-hub/trend-radar/${digestId}`,
        plan: pipeline.actionPlan,
      });
    }

    return digestId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generate digest gagal.";
    await prisma.trendRadarDigest.update({
      where: { id: digestId },
      data: {
        status: TrendRadarStatus.FAILED,
        digestMode: "FAILED",
        errorMessage: message,
      },
    });
    throw err;
  }
}

export { weekBounds };
