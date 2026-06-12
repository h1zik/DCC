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
import { seedDefaultProjectMilestones } from "@/lib/project-milestones";

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
    `**Marketplace:** ${source.marketplace}`,
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
