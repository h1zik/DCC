"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { ProductConceptMode, ProductConceptStatus, ProductInnovationStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import { generateProductInnovation } from "@/lib/research/product-innovation/innovation-generator";
import { parseScamperIdeas } from "@/lib/research/product-innovation/types";
import { emptyConceptData } from "@/lib/research/concept-lab/types";

const sourceModulesSchema = z.object({
  reviewIntel: z.boolean().optional(),
  competitor: z.boolean().optional(),
  trendRadar: z.boolean().optional(),
  keywordIntel: z.boolean().optional(),
  socialListening: z.boolean().optional(),
});

const createSchema = z.object({
  baseProduct: z.string().min(1).max(200),
  category: z.string().min(1).max(120),
  targetMarket: z.string().max(200).optional(),
  priceTargetMin: z.number().min(0).optional(),
  priceTargetMax: z.number().min(0).optional(),
  brandId: z.string().optional(),
  baseConceptId: z.string().optional(),
  sourceModules: sourceModulesSchema.optional(),
});

export async function createProductInnovation(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = createSchema.parse(input);

  let baseProduct = data.baseProduct.trim();
  let category = data.category.trim();
  let targetMarket = data.targetMarket?.trim() || null;
  let priceTargetMin = data.priceTargetMin ?? null;
  let priceTargetMax = data.priceTargetMax ?? null;
  let sourceModules: Record<string, unknown> = data.sourceModules ?? {};
  let brandId = data.brandId ?? null;

  // Prefill dari konsep Concept Lab bila dipilih sebagai basis.
  if (data.baseConceptId) {
    const concept = await prisma.productConcept.findUnique({
      where: { id: data.baseConceptId },
    });
    if (concept) {
      if (!baseProduct) baseProduct = concept.title;
      if (!category) category = concept.category;
      targetMarket = targetMarket ?? concept.targetMarket;
      priceTargetMin = priceTargetMin ?? concept.priceTargetMin;
      priceTargetMax = priceTargetMax ?? concept.priceTargetMax;
      brandId = brandId ?? concept.brandId;
      if (
        Object.keys(sourceModules).length === 0 &&
        concept.sourceModules &&
        typeof concept.sourceModules === "object"
      ) {
        sourceModules = concept.sourceModules as Record<string, unknown>;
      }
    }
  }

  const innovation = await prisma.productInnovation.create({
    data: {
      title: `SCAMPER — ${baseProduct}`.slice(0, 180),
      baseProduct,
      category,
      targetMarket,
      priceTargetMin,
      priceTargetMax,
      brandId,
      baseConceptId: data.baseConceptId ?? null,
      sourceModules: sourceModules as object,
      status: ProductInnovationStatus.GENERATING,
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await generateProductInnovation(innovation.id);
    } catch (err) {
      console.error("[createProductInnovation] generate gagal", err);
    }
  });

  revalidatePath("/research-hub/product-innovation");
  return { id: innovation.id };
}

export async function regenerateProductInnovation(innovationId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(innovationId);

  const innovation = await prisma.productInnovation.findUnique({
    where: { id: innovationId },
    select: { id: true },
  });
  if (!innovation) throw new Error("Sesi inovasi tidak ditemukan.");

  await prisma.productInnovation.update({
    where: { id: innovationId },
    data: { status: ProductInnovationStatus.GENERATING, errorMessage: null },
  });

  after(async () => {
    try {
      await generateProductInnovation(innovationId);
    } catch (err) {
      console.error("[regenerateProductInnovation] gagal", err);
    }
  });

  revalidatePath(`/research-hub/product-innovation/${innovationId}`);
}

export async function deleteProductInnovation(innovationId: string) {
  await requireMarketAnalyst();
  await prisma.productInnovation.deleteMany({ where: { id: innovationId } });
  revalidatePath("/research-hub/product-innovation");
}

/**
 * Promosikan satu ide SCAMPER menjadi ProductConcept (mode MANUAL, conceptData
 * ter-prefill) agar seluruh alur Concept Lab (validate / compare / send-to-R&D)
 * langsung berlaku tanpa duplikasi.
 */
export async function promoteIdeaToConcept(
  innovationId: string,
  ideaId: string,
) {
  const session = await requireMarketAnalyst();

  const innovation = await prisma.productInnovation.findUnique({
    where: { id: innovationId },
  });
  if (!innovation) throw new Error("Sesi inovasi tidak ditemukan.");

  const ideas = parseScamperIdeas(innovation.ideas);
  const idea = ideas.find((i) => i.id === ideaId);
  if (!idea) throw new Error("Ide tidak ditemukan.");
  if (idea.promotedConceptId) {
    return { id: idea.promotedConceptId, alreadyPromoted: true };
  }

  const conceptData = {
    ...emptyConceptData(),
    nameOptions: [idea.title],
    selectedName: idea.title,
    positioningStatement: idea.description,
    keyClaims: [idea.benefit].filter(Boolean),
    whyItWillWin: idea.rationale,
  };

  const concept = await prisma.productConcept.create({
    data: {
      title: idea.title,
      category: innovation.category,
      targetMarket: innovation.targetMarket,
      priceTargetMin: innovation.priceTargetMin,
      priceTargetMax: innovation.priceTargetMax,
      mode: ProductConceptMode.MANUAL,
      status: ProductConceptStatus.DRAFT,
      brandId: innovation.brandId,
      sourceModules:
        innovation.sourceModules && typeof innovation.sourceModules === "object"
          ? (innovation.sourceModules as object)
          : {},
      conceptData: conceptData as object,
      createdById: session.user.id,
    },
  });

  const updatedIdeas = ideas.map((i) =>
    i.id === ideaId ? { ...i, promotedConceptId: concept.id } : i,
  );
  await prisma.productInnovation.update({
    where: { id: innovationId },
    data: { ideas: updatedIdeas as object },
  });

  revalidatePath(`/research-hub/product-innovation/${innovationId}`);
  revalidatePath("/research-hub/concept-lab");
  return { id: concept.id, alreadyPromoted: false };
}
