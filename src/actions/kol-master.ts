"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireKolApprover, requireKolUser } from "@/lib/kol/auth";
import { logKolAudit, type KolAuditEntity } from "@/lib/kol/audit";
import { computeBudgetUsage } from "@/lib/kol/budget";
import {
  briefInputSchema,
  budgetInputSchema,
  campaignInputSchema,
  categoryInputSchema,
  endorseTypeInputSchema,
  productPriceInputSchema,
} from "@/lib/kol/validation";
import { toDecimal } from "@/lib/finance-money";
import { prisma } from "@/lib/prisma";

function revalidateSettings() {
  revalidatePath("/kol-hub", "layout");
}

function uniqueNameError(e: unknown, what: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new Error(`${what} dengan nama itu sudah ada.`);
  }
  throw e;
}

async function audit(
  actorId: string,
  entityType: KolAuditEntity,
  entityId: string,
  action: string,
  meta?: Prisma.InputJsonValue,
) {
  await logKolAudit(prisma, { actorId, entityType, entityId, action, meta });
}

const idSchema = z.string().min(1);

/* ---------------- Kategori ---------------- */

export async function saveKolCategory(
  id: string | null,
  input: z.input<typeof categoryInputSchema>,
) {
  const session = await requireKolUser();
  const data = categoryInputSchema.parse(input);
  try {
    const row = id
      ? await prisma.kolCategory.update({ where: { id }, data })
      : await prisma.kolCategory.create({ data });
    await audit(session.user.id, "category", row.id, id ? "category.update" : "category.create");
  } catch (e) {
    uniqueNameError(e, "Kategori");
  }
  revalidateSettings();
}

export async function setKolCategoryArchived(id: string, archived: boolean) {
  const session = await requireKolUser();
  await prisma.kolCategory.update({
    where: { id: idSchema.parse(id) },
    data: { archivedAt: archived ? new Date() : null },
  });
  await audit(session.user.id, "category", id, archived ? "category.archive" : "category.restore");
  revalidateSettings();
}

/* ---------------- Jenis endorse ---------------- */

export async function saveKolEndorseType(
  id: string | null,
  input: z.input<typeof endorseTypeInputSchema>,
) {
  const session = await requireKolUser();
  const data = endorseTypeInputSchema.parse(input);
  try {
    const row = id
      ? await prisma.kolEndorseType.update({ where: { id }, data })
      : await prisma.kolEndorseType.create({ data });
    await audit(
      session.user.id,
      "endorse_type",
      row.id,
      id ? "endorse_type.update" : "endorse_type.create",
    );
  } catch (e) {
    uniqueNameError(e, "Jenis endorse");
  }
  revalidateSettings();
}

export async function setKolEndorseTypeArchived(id: string, archived: boolean) {
  const session = await requireKolUser();
  await prisma.kolEndorseType.update({
    where: { id: idSchema.parse(id) },
    data: { archivedAt: archived ? new Date() : null },
  });
  await audit(
    session.user.id,
    "endorse_type",
    id,
    archived ? "endorse_type.archive" : "endorse_type.restore",
  );
  revalidateSettings();
}

/* ---------------- Brief ---------------- */

export async function saveKolBrief(id: string | null, input: z.input<typeof briefInputSchema>) {
  const session = await requireKolUser();
  const data = briefInputSchema.parse(input);
  const row = id
    ? await prisma.kolBrief.update({ where: { id }, data })
    : await prisma.kolBrief.create({ data });
  await audit(session.user.id, "brief", row.id, id ? "brief.update" : "brief.create");
  revalidateSettings();
  return { id: row.id };
}

export async function archiveKolBrief(id: string) {
  const session = await requireKolUser();
  await prisma.kolBrief.update({
    where: { id: idSchema.parse(id) },
    data: { archivedAt: new Date() },
  });
  await audit(session.user.id, "brief", id, "brief.archive");
  revalidateSettings();
}

/* ---------------- Budget (khusus approver) ---------------- */

export async function saveKolBudget(id: string | null, input: z.input<typeof budgetInputSchema>) {
  const session = await requireKolApprover();
  const data = budgetInputSchema.parse(input);
  const beginningBalance = toDecimal(data.beginningBalance);

  if (id) {
    const existing = await prisma.kolBudget.findUniqueOrThrow({
      where: { id },
      select: { brandId: true, _count: { select: { campaigns: true } } },
    });
    if (existing.brandId !== data.brandId && existing._count.campaigns > 0) {
      throw new Error("Budget sudah dipakai campaign — brand-nya tidak bisa diganti.");
    }
    const usage = (await computeBudgetUsage(prisma, [id])).get(id);
    if (usage && Number(beginningBalance) < usage.committed) {
      throw new Error(
        "Saldo awal tidak boleh lebih kecil dari yang sudah terpakai oleh jadwal.",
      );
    }
  }

  const row = id
    ? await prisma.kolBudget.update({
        where: { id },
        data: { brandId: data.brandId, name: data.name, beginningBalance, notes: data.notes },
      })
    : await prisma.kolBudget.create({
        data: {
          brandId: data.brandId,
          name: data.name,
          beginningBalance,
          notes: data.notes,
          createdById: session.user.id,
        },
      });
  await audit(session.user.id, "budget", row.id, id ? "budget.update" : "budget.create", {
    beginningBalance: data.beginningBalance,
  });
  revalidateSettings();
  return { id: row.id };
}

export async function archiveKolBudget(id: string) {
  const session = await requireKolApprover();
  const active = await prisma.kolCampaign.count({
    where: { budgetId: id, archivedAt: null },
  });
  if (active > 0) {
    throw new Error("Budget masih dipakai campaign aktif — arsipkan campaign-nya dulu.");
  }
  await prisma.kolBudget.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(session.user.id, "budget", id, "budget.archive");
  revalidateSettings();
}

/* ---------------- Campaign ---------------- */

export async function saveKolCampaign(
  id: string | null,
  input: z.input<typeof campaignInputSchema>,
) {
  const session = await requireKolUser();
  const data = campaignInputSchema.parse(input);
  const budget = await prisma.kolBudget.findUnique({
    where: { id: data.budgetId },
    select: { brandId: true, archivedAt: true },
  });
  if (!budget || budget.archivedAt) throw new Error("Budget tidak ditemukan.");
  if (budget.brandId !== data.brandId) throw new Error("Budget itu milik brand lain.");

  if (id) {
    const used = await prisma.kolSchedule.count({ where: { campaignId: id } });
    const existing = await prisma.kolCampaign.findUniqueOrThrow({
      where: { id },
      select: { brandId: true },
    });
    if (used > 0 && existing.brandId !== data.brandId) {
      throw new Error("Campaign sudah punya jadwal — brand-nya tidak bisa diganti.");
    }
  }

  const fields = {
    brandId: data.brandId,
    budgetId: data.budgetId,
    title: data.title,
    description: data.description,
    startDate: data.startDate ? new Date(`${data.startDate}T00:00:00Z`) : null,
    endDate: data.endDate ? new Date(`${data.endDate}T00:00:00Z`) : null,
    picUserId: data.picUserId,
  };
  const row = id
    ? await prisma.kolCampaign.update({ where: { id }, data: fields })
    : await prisma.kolCampaign.create({ data: fields });
  await audit(session.user.id, "campaign", row.id, id ? "campaign.update" : "campaign.create");
  revalidateSettings();
  return { id: row.id };
}

export async function archiveKolCampaign(id: string) {
  const session = await requireKolUser();
  const open = await prisma.kolSchedule.count({
    where: {
      campaignId: id,
      status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED"] },
    },
  });
  if (open > 0) {
    throw new Error(
      "Campaign masih punya jadwal yang berjalan — selesaikan atau batalkan dulu.",
    );
  }
  await prisma.kolCampaign.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(session.user.id, "campaign", id, "campaign.archive");
  revalidateSettings();
}

/* ---------------- Harga produk ---------------- */

export async function setProductRetailPrice(input: z.input<typeof productPriceInputSchema>) {
  const session = await requireKolUser();
  const data = productPriceInputSchema.parse(input);
  await prisma.product.update({
    where: { id: data.productId },
    data: { retailPrice: data.retailPrice ? toDecimal(data.retailPrice) : null },
  });
  await audit(session.user.id, "product", data.productId, "product.price", {
    retailPrice: data.retailPrice,
  });
  revalidateSettings();
}
