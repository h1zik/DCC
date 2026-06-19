"use server";

import { revalidatePath } from "next/cache";
import {
  PipelineStage,
  RoomTaskProcess,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import { requireBrandManager } from "@/lib/brand-research/auth";
import { seedDefaultProjectMilestones } from "@/lib/project-milestones";
import { getReviewPlatformLabel } from "@/lib/review-platforms/platforms";

const briefSchema = z.object({
  sourceId: z.string().min(1),
  roomId: z.string().min(1),
  brandId: z.string().min(1),
  projectName: z.string().min(1).max(200),
});

export async function createProductBriefFromInsight(
  input: z.infer<typeof briefSchema>,
) {
  await requireMarketAnalyst();
  const data = briefSchema.parse(input);

  const source = await prisma.reviewIntelSource.findUnique({
    where: { id: data.sourceId },
    include: { summary: true },
  });
  if (!source?.summary) {
    throw new Error("Insight belum siap — tunggu analisis selesai.");
  }

  const topComplaints = Array.isArray(source.summary.topComplaints)
    ? (source.summary.topComplaints as { theme: string; count: number }[])
    : [];
  const complaintLines = topComplaints
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c.theme} (${c.count} review)`)
    .join("\n");

  const description = [
    `## Product Brief dari Review Intelligence`,
    ``,
    `**Produk kompetitor:** ${source.productName} (${source.competitorBrand})`,
    `**Sumber review:** ${getReviewPlatformLabel(source.platformKey)}`,
    ``,
    `### Gap Opportunity`,
    source.summary.gapOpportunity ?? "—",
    ``,
    `### Top Complaints`,
    complaintLines || "—",
    ``,
    `### Sentimen`,
    `- Positif: ${source.summary.positivePct.toFixed(1)}%`,
    `- Netral: ${source.summary.neutralPct.toFixed(1)}%`,
    `- Negatif: ${source.summary.negativePct.toFixed(1)}%`,
  ].join("\n");

  const project = await prisma.project.create({
    data: {
      roomId: data.roomId,
      brandId: data.brandId,
      name: data.projectName,
      currentStage: PipelineStage.MARKET_RESEARCH,
      stageEnteredAt: new Date(),
    },
  });

  await seedDefaultProjectMilestones(prisma, project.id);

  const maxSort = await prisma.task.aggregate({
    where: { projectId: project.id, roomProcess: RoomTaskProcess.MARKET_RESEARCH },
    _max: { sortOrder: true },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      roomProcess: RoomTaskProcess.MARKET_RESEARCH,
      title: `Brief: ${source.productName}`,
      description,
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/tasks");
  return { projectId: project.id, roomId: data.roomId };
}

const trendBriefSchema = z.object({
  trendItemId: z.string().min(1),
  roomId: z.string().min(1),
  brandId: z.string().min(1),
  projectName: z.string().min(1).max(200),
});

export async function createProductBriefFromTrend(
  input: z.infer<typeof trendBriefSchema>,
) {
  await requireMarketAnalyst();
  const data = trendBriefSchema.parse(input);

  const item = await prisma.trendRadarItem.findUnique({
    where: { id: data.trendItemId },
    include: { digest: true },
  });
  if (!item) throw new Error("Item tren tidak ditemukan.");

  const products = Array.isArray(item.relatedProducts)
    ? (item.relatedProducts as string[])
    : [];

  const description = [
    `## Product Brief dari Trend Radar`,
    ``,
    `**Tren:** ${item.name}`,
    `**Dimensi:** ${item.dimension} · **Fase:** ${item.phase}`,
    item.isGlobalPipeline ? `**Global → Local:** Ya` : "",
    ``,
    `### Narasi`,
    item.narrative ?? "—",
    ``,
    `### Produk terkait di pasar`,
    products.length > 0 ? products.map((p) => `- ${p}`).join("\n") : "—",
    ``,
    `### Konteks digest`,
    item.digest.narrative ?? "—",
  ]
    .filter(Boolean)
    .join("\n");

  const project = await prisma.project.create({
    data: {
      roomId: data.roomId,
      brandId: data.brandId,
      name: data.projectName,
      currentStage: PipelineStage.MARKET_RESEARCH,
      stageEnteredAt: new Date(),
    },
  });

  await seedDefaultProjectMilestones(prisma, project.id);

  const maxSort = await prisma.task.aggregate({
    where: { projectId: project.id, roomProcess: RoomTaskProcess.MARKET_RESEARCH },
    _max: { sortOrder: true },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      roomProcess: RoomTaskProcess.MARKET_RESEARCH,
      title: `Brief: ${item.name}`,
      description,
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/tasks");
  return { projectId: project.id, roomId: data.roomId };
}

const keywordBriefSchema = z.object({
  queryId: z.string().min(1),
  roomId: z.string().min(1),
  brandId: z.string().min(1),
  projectName: z.string().min(1).max(200),
});

export async function createProductBriefFromKeyword(
  input: z.infer<typeof keywordBriefSchema>,
) {
  const data = keywordBriefSchema.parse(input);

  const [researchQuery, brandQuery] = await Promise.all([
    prisma.keywordIntelQuery.findUnique({
      where: { id: data.queryId },
      include: { result: true },
    }),
    prisma.brandKeywordQuery.findUnique({
      where: { id: data.queryId },
      include: { result: true },
    }),
  ]);

  const query = researchQuery ?? brandQuery;
  if (!query?.result) {
    throw new Error("Hasil keyword belum siap.");
  }

  if (brandQuery && !researchQuery) {
    await requireBrandManager();
  } else {
    await requireMarketAnalyst();
  }

  const gaps = Array.isArray(query.result.gapKeywords)
    ? (query.result.gapKeywords as { keyword: string; reason: string }[])
    : [];
  const naming = Array.isArray(query.result.namingSuggestions)
    ? (query.result.namingSuggestions as string[])
    : [];

  const description = [
    `## Product Brief dari Keyword Intel`,
    ``,
    `**Kategori:** ${query.category}`,
    query.seedKeyword ? `**Seed keyword:** ${query.seedKeyword}` : "",
    ``,
    `### AI Summary`,
    query.result.aiSummary ?? "—",
    ``,
    `### Keyword Gap (peluang)`,
    gaps.length > 0
      ? gaps
          .slice(0, 8)
          .map((g, i) => `${i + 1}. ${g.keyword} — ${g.reason}`)
          .join("\n")
      : "—",
    ``,
    `### Rekomendasi Nama Produk`,
    naming.length > 0 ? naming.map((n, i) => `${i + 1}. ${n}`).join("\n") : "—",
  ]
    .filter(Boolean)
    .join("\n");

  const project = await prisma.project.create({
    data: {
      roomId: data.roomId,
      brandId: data.brandId,
      name: data.projectName,
      currentStage: PipelineStage.MARKET_RESEARCH,
      stageEnteredAt: new Date(),
    },
  });

  await seedDefaultProjectMilestones(prisma, project.id);

  const maxSort = await prisma.task.aggregate({
    where: { projectId: project.id, roomProcess: RoomTaskProcess.MARKET_RESEARCH },
    _max: { sortOrder: true },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      roomProcess: RoomTaskProcess.MARKET_RESEARCH,
      title: `Brief: ${query.category}`,
      description,
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/tasks");
  return { projectId: project.id, roomId: data.roomId };
}

const socialBriefSchema = z.object({
  monitorId: z.string().min(1),
  insightType: z.enum(["pain", "wishlist", "viral"]),
  roomId: z.string().min(1),
  brandId: z.string().min(1),
  projectName: z.string().min(1).max(200),
});

export async function createProductBriefFromSocialInsight(
  input: z.infer<typeof socialBriefSchema>,
) {
  await requireMarketAnalyst();
  const data = socialBriefSchema.parse(input);

  const monitor = await prisma.socialListeningMonitor.findUnique({
    where: { id: data.monitorId },
    include: {
      batches: {
        where: { status: "READY" },
        orderBy: { collectedAt: "desc" },
        take: 1,
        include: { summary: true },
      },
    },
  });

  const summary = monitor?.batches[0]?.summary;
  if (!monitor || !summary) {
    throw new Error("Insight social listening belum siap.");
  }

  const painPoints = Array.isArray(summary.topPainPoints)
    ? (summary.topPainPoints as { theme: string; count: number }[])
    : [];
  const wishlist = Array.isArray(summary.topWishlist)
    ? (summary.topWishlist as { theme: string; count: number }[])
    : [];
  const viral = Array.isArray(summary.viralContent)
    ? (summary.viralContent as { text: string; author: string | null }[])
    : [];

  let sectionTitle = "Top Pain Points";
  let sectionBody = painPoints
    .slice(0, 8)
    .map((p, i) => `${i + 1}. ${p.theme} (${p.count}x)`)
    .join("\n");

  if (data.insightType === "wishlist") {
    sectionTitle = "Top Wishlist";
    sectionBody = wishlist
      .slice(0, 8)
      .map((w, i) => `${i + 1}. ${w.theme} (${w.count}x)`)
      .join("\n");
  } else if (data.insightType === "viral") {
    sectionTitle = "Viral Content";
    sectionBody = viral
      .slice(0, 5)
      .map((v, i) => `${i + 1}. ${v.author ? `@${v.author}: ` : ""}${v.text}`)
      .join("\n");
  }

  const description = [
    `## Product Brief dari Social Listening`,
    ``,
    `**Monitor:** ${monitor.name}`,
    `**Keywords:** ${monitor.keywords.join(", ")}`,
    ``,
    `### AI Summary`,
    summary.aiSummary ?? "—",
    ``,
    `### ${sectionTitle}`,
    sectionBody || "—",
  ].join("\n");

  const project = await prisma.project.create({
    data: {
      roomId: data.roomId,
      brandId: data.brandId,
      name: data.projectName,
      currentStage: PipelineStage.MARKET_RESEARCH,
      stageEnteredAt: new Date(),
    },
  });

  await seedDefaultProjectMilestones(prisma, project.id);

  const maxSort = await prisma.task.aggregate({
    where: { projectId: project.id, roomProcess: RoomTaskProcess.MARKET_RESEARCH },
    _max: { sortOrder: true },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      roomProcess: RoomTaskProcess.MARKET_RESEARCH,
      title: `Brief: ${monitor.name}`,
      description,
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/tasks");
  return { projectId: project.id, roomId: data.roomId };
}

const uspBriefSchema = z.object({
  analysisId: z.string().min(1),
  uspIndex: z.number().int().min(0),
  roomId: z.string().min(1),
  brandId: z.string().min(1),
  projectName: z.string().min(1).max(200),
});

export async function createProductBriefFromUsp(
  input: z.infer<typeof uspBriefSchema>,
) {
  await requireMarketAnalyst();
  const data = uspBriefSchema.parse(input);

  const analysis = await prisma.uspGapAnalysis.findUnique({
    where: { id: data.analysisId },
    include: { result: true },
  });
  if (!analysis?.result) {
    throw new Error("Hasil analisis USP belum siap.");
  }

  const candidates = Array.isArray(analysis.result.uspCandidates)
    ? (analysis.result.uspCandidates as {
        usp: string;
        rtb: string;
        differentiationScore: number;
        risks: string[];
      }[])
    : [];

  const pick = candidates[data.uspIndex];
  if (!pick) throw new Error("Kandidat USP tidak ditemukan.");

  const gaps = Array.isArray(analysis.result.gapMatrix)
    ? (analysis.result.gapMatrix as {
        claim: string;
        gapScore: number;
        opportunity: string;
      }[])
    : [];

  const description = [
    `## Product Brief dari USP & Gap Analyzer`,
    ``,
    `**Kategori:** ${analysis.category}`,
    ``,
    `### USP Terpilih`,
    pick.usp,
    ``,
    `### Reason to Believe`,
    pick.rtb,
    ``,
    `### Differentiation Score`,
    `${pick.differentiationScore}/100`,
    ``,
    `### Risiko`,
    pick.risks?.length > 0 ? pick.risks.map((r) => `- ${r}`).join("\n") : "—",
    ``,
    `### Top Gap Opportunities`,
    gaps.length > 0
      ? gaps
          .slice(0, 5)
          .map(
            (g, i) =>
              `${i + 1}. ${g.claim} (gap ${g.gapScore}) — ${g.opportunity}`,
          )
          .join("\n")
      : "—",
    ``,
    `### AI Summary`,
    analysis.result.aiSummary ?? "—",
  ].join("\n");

  const project = await prisma.project.create({
    data: {
      roomId: data.roomId,
      brandId: data.brandId,
      name: data.projectName,
      currentStage: PipelineStage.MARKET_RESEARCH,
      stageEnteredAt: new Date(),
    },
  });

  await seedDefaultProjectMilestones(prisma, project.id);

  const maxSort = await prisma.task.aggregate({
    where: { projectId: project.id, roomProcess: RoomTaskProcess.MARKET_RESEARCH },
    _max: { sortOrder: true },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      roomProcess: RoomTaskProcess.MARKET_RESEARCH,
      title: `Brief: ${pick.usp.slice(0, 80)}`,
      description,
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/tasks");
  return { projectId: project.id, roomId: data.roomId };
}
