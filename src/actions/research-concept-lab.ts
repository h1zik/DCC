"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  PipelineStage,
  ProductConceptMode,
  ProductConceptStatus,
  RoomTaskProcess,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import { compareProductConcepts } from "@/lib/research/concept-lab/compare-concepts";
import { generateProductConcept } from "@/lib/research/concept-lab/concept-generator";
import { validateProductConceptById } from "@/lib/research/concept-lab/concept-validator";
import { buildMaklonBriefHtml } from "@/lib/research/concept-lab/maklon-brief-html";
import {
  emptyConceptData,
  parseConceptData,
  parseValidationScores,
  type ConceptData,
} from "@/lib/research/concept-lab/types";
import { seedDefaultProjectMilestones } from "@/lib/project-milestones";

const sourceModulesSchema = z.object({
  reviewIntel: z.boolean().optional(),
  competitor: z.boolean().optional(),
  trendRadar: z.boolean().optional(),
  keywordIntel: z.boolean().optional(),
  socialListening: z.boolean().optional(),
});

const createSchema = z.object({
  mode: z.nativeEnum(ProductConceptMode),
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(120),
  targetMarket: z.string().max(200).optional(),
  priceTargetMin: z.number().min(0).optional(),
  priceTargetMax: z.number().min(0).optional(),
  brandId: z.string().optional(),
  uspGapAnalysisId: z.string().optional(),
  uspIndex: z.number().int().min(0).optional(),
  sourceModules: sourceModulesSchema.optional(),
});

function hasAnyModule(mods?: Record<string, unknown>): boolean {
  if (!mods) return false;
  return Object.values(mods).some((v) => v === true);
}

export async function createProductConcept(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = createSchema.parse(input);

  // Inherit the parent USP analysis' context modules so Concept Lab validates
  // with the same upstream evidence instead of an empty context.
  let sourceModules: Record<string, unknown> = data.sourceModules ?? {};
  if (data.uspGapAnalysisId && !hasAnyModule(sourceModules)) {
    const parent = await prisma.uspGapAnalysis.findUnique({
      where: { id: data.uspGapAnalysisId },
      select: { contextModules: true },
    });
    if (parent?.contextModules && typeof parent.contextModules === "object") {
      sourceModules = parent.contextModules as Record<string, unknown>;
    }
  }

  const concept = await prisma.productConcept.create({
    data: {
      title: data.title.trim(),
      category: data.category.trim(),
      targetMarket: data.targetMarket?.trim() ?? null,
      priceTargetMin: data.priceTargetMin ?? null,
      priceTargetMax: data.priceTargetMax ?? null,
      mode: data.mode,
      brandId: data.brandId ?? null,
      uspGapAnalysisId: data.uspGapAnalysisId ?? null,
      uspIndex: data.uspIndex ?? null,
      sourceModules: sourceModules as object,
      conceptData: emptyConceptData(),
      status: ProductConceptStatus.DRAFT,
      createdById: session.user.id,
    },
  });

  if (data.mode === ProductConceptMode.AI_GENERATED) {
    await prisma.productConcept.update({
      where: { id: concept.id },
      data: { status: ProductConceptStatus.VALIDATING },
    });
    after(async () => {
      try {
        await generateProductConcept(concept.id);
      } catch (err) {
        console.error("[createProductConcept] generate gagal", err);
      }
    });
  }

  revalidatePath("/research-hub/concept-lab");
  return { id: concept.id };
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  targetMarket: z.string().max(200).optional(),
  priceTargetMin: z.number().min(0).optional(),
  priceTargetMax: z.number().min(0).optional(),
  conceptData: z.custom<ConceptData>().optional(),
});

export async function updateProductConcept(
  input: z.infer<typeof updateSchema>,
) {
  await requireMarketAnalyst();
  const data = updateSchema.parse(input);

  await prisma.productConcept.update({
    where: { id: data.id },
    data: {
      ...(data.title ? { title: data.title } : {}),
      ...(data.targetMarket !== undefined
        ? { targetMarket: data.targetMarket }
        : {}),
      ...(data.priceTargetMin !== undefined
        ? { priceTargetMin: data.priceTargetMin }
        : {}),
      ...(data.priceTargetMax !== undefined
        ? { priceTargetMax: data.priceTargetMax }
        : {}),
      ...(data.conceptData ? { conceptData: data.conceptData } : {}),
      status: ProductConceptStatus.DRAFT,
    },
  });

  revalidatePath("/research-hub/concept-lab");
  revalidatePath(`/research-hub/concept-lab/${data.id}`);
}

export async function validateProductConcept(conceptId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(conceptId);

  await prisma.productConcept.update({
    where: { id: conceptId },
    data: { status: ProductConceptStatus.VALIDATING },
  });

  after(async () => {
    try {
      await validateProductConceptById(conceptId);
    } catch (err) {
      console.error("[validateProductConcept] gagal", err);
    }
  });

  revalidatePath("/research-hub/concept-lab");
  revalidatePath(`/research-hub/concept-lab/${conceptId}`);
}

export async function compareConcepts(conceptIds: string[]) {
  await requireMarketAnalyst();
  z.array(z.string().min(1)).min(2).max(3).parse(conceptIds);
  return compareProductConcepts(conceptIds);
}

export async function archiveProductConcept(conceptId: string) {
  await requireMarketAnalyst();
  await prisma.productConcept.update({
    where: { id: conceptId },
    data: { status: ProductConceptStatus.ARCHIVED },
  });
  revalidatePath("/research-hub/concept-lab");
}

export async function deleteProductConcept(conceptId: string) {
  await requireMarketAnalyst();
  await prisma.productConcept.delete({ where: { id: conceptId } });
  revalidatePath("/research-hub/concept-lab");
}

export async function getMaklonBriefHtml(conceptId: string) {
  await requireMarketAnalyst();
  const concept = await prisma.productConcept.findUnique({
    where: { id: conceptId },
  });
  if (!concept) throw new Error("Konsep tidak ditemukan.");

  return buildMaklonBriefHtml({
    title: concept.title,
    category: concept.category,
    targetMarket: concept.targetMarket,
    priceTargetMin: concept.priceTargetMin,
    priceTargetMax: concept.priceTargetMax,
    conceptData: parseConceptData(concept.conceptData),
    validationScores: parseValidationScores(concept.validationScores),
  });
}

const rdTaskSchema = z.object({
  conceptId: z.string().min(1),
  roomId: z.string().min(1),
  brandId: z.string().min(1),
  projectName: z.string().min(1).max(200),
});

export async function sendConceptToRdTask(
  input: z.infer<typeof rdTaskSchema>,
) {
  await requireMarketAnalyst();
  const data = rdTaskSchema.parse(input);

  const concept = await prisma.productConcept.findUnique({
    where: { id: data.conceptId },
  });
  if (!concept) throw new Error("Konsep tidak ditemukan.");

  const conceptData = parseConceptData(concept.conceptData);
  const scores = parseValidationScores(concept.validationScores);
  const productName =
    conceptData.selectedName ??
    conceptData.nameOptions[0] ??
    concept.title;

  const description = [
    `## Brief R&D dari Product Concept Lab`,
    ``,
    `**Produk:** ${productName}`,
    `**Kategori:** ${concept.category}`,
    `**Target market:** ${concept.targetMarket ?? "—"}`,
    ``,
    `### Positioning`,
    conceptData.positioningStatement || "—",
    ``,
    `### Hero Ingredients`,
    conceptData.heroIngredients.length > 0
      ? conceptData.heroIngredients
          .map((i) => `- ${i.name}: ${i.reason}`)
          .join("\n")
      : "—",
    ``,
    `### Texture & Format`,
    conceptData.textureFormat || "—",
    ``,
    `### Key Claims`,
    conceptData.keyClaims.length > 0
      ? conceptData.keyClaims.map((c) => `- ${c}`).join("\n")
      : "—",
    ``,
    `### Packaging`,
    conceptData.packagingDirection || "—",
    ``,
    `### Validator Overall Score`,
    `${scores.overall}/100`,
    ``,
    `### Why It Will Win`,
    conceptData.whyItWillWin || "—",
  ].join("\n");

  const project = await prisma.project.create({
    data: {
      roomId: data.roomId,
      brandId: data.brandId,
      name: data.projectName,
      currentStage: PipelineStage.PRODUCT_DEVELOPMENT,
      stageEnteredAt: new Date(),
    },
  });

  await seedDefaultProjectMilestones(prisma, project.id);

  const maxSort = await prisma.task.aggregate({
    where: {
      projectId: project.id,
      roomProcess: RoomTaskProcess.PRODUCT_DEVELOPMENT,
    },
    _max: { sortOrder: true },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      roomProcess: RoomTaskProcess.PRODUCT_DEVELOPMENT,
      title: `R&D Brief: ${productName}`,
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
