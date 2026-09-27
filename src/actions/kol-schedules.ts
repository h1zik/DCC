"use server";

import {
  KolPostStatus,
  KolScheduleStatus,
  KolShipmentStatus,
  KolStatus,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireKolUser } from "@/lib/kol/auth";
import { logKolAudit } from "@/lib/kol/audit";
import { assertBudgetFits } from "@/lib/kol/budget";
import { enqueueKolPostSync } from "@/lib/kol/post-sync";
import { parsePostUrl } from "@/lib/kol/post-url";
import { notifyKolApprovers } from "@/lib/kol/notify";
import { kolSubNumber, nextKolOrderNumber } from "@/lib/kol/numbering";
import { wibInputToDate } from "@/lib/kol/time";
import {
  scheduleOrderInputSchema,
  type ScheduleOrderInput,
} from "@/lib/kol/validation";
import { toDecimal } from "@/lib/finance-money";
import { prisma } from "@/lib/prisma";

function revalidateSchedules(id?: string) {
  revalidatePath("/kol-hub");
  revalidatePath("/kol-hub/schedules");
  revalidatePath("/kol-hub/calendar");
  revalidatePath("/kol-hub/approvals");
  revalidatePath("/kol-hub/campaigns");
  if (id) revalidatePath(`/kol-hub/schedules/${id}`);
}

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Buat satu order kolaborasi berisi N slot. Tiap slot jadi satu jadwal.
 * `submit: true` langsung mengajukan (dan mengecek budget); `false` = draf.
 */
export async function createScheduleOrder(input: ScheduleOrderInput) {
  const session = await requireKolUser();
  const data = scheduleOrderInputSchema.parse(input);
  const actorId = session.user.id;

  const result = await prisma.$transaction(async (tx) => {
    const [campaign, kol] = await Promise.all([
      tx.kolCampaign.findUnique({
        where: { id: data.campaignId },
        select: { id: true, brandId: true, budgetId: true, archivedAt: true, title: true },
      }),
      tx.kolProfile.findUnique({
        where: { id: data.kolId },
        select: {
          id: true,
          status: true,
          fullName: true,
          socialAccounts: { select: { id: true, platform: true } },
        },
      }),
    ]);
    if (!campaign || campaign.archivedAt) throw new Error("Campaign tidak ditemukan.");
    if (campaign.brandId !== data.brandId) {
      throw new Error("Campaign itu milik brand lain.");
    }
    if (!kol) throw new Error("KOL tidak ditemukan.");
    if (kol.status !== KolStatus.ACTIVE) {
      throw new Error(
        `${kol.fullName} belum aktif — KOL harus disetujui dulu sebelum bisa dijadwalkan.`,
      );
    }

    const accountIds = new Set(kol.socialAccounts.map((a) => a.id));
    const endorseTypeIds = [...new Set(data.slots.map((s) => s.endorseTypeId))];
    const briefIds = [...new Set(data.slots.map((s) => s.briefId).filter(Boolean))] as string[];
    const productIds = [...new Set(data.slots.flatMap((s) => s.productIds))];

    const [endorseTypes, briefs, products] = await Promise.all([
      tx.kolEndorseType.findMany({
        where: { id: { in: endorseTypeIds }, archivedAt: null },
        select: { id: true, isBarter: true },
      }),
      tx.kolBrief.findMany({
        where: { id: { in: briefIds }, archivedAt: null },
        select: { id: true, brandId: true },
      }),
      tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, brandId: true, retailPrice: true },
      }),
    ]);
    const typeById = new Map(endorseTypes.map((t) => [t.id, t]));
    const productById = new Map(products.map((p) => [p.id, p]));

    const slots = data.slots.map((s, i) => {
      const label = `Slot ${i + 1}`;
      if (!accountIds.has(s.socialAccountId)) {
        throw new Error(`${label}: akun sosmed bukan milik KOL ini.`);
      }
      const type = typeById.get(s.endorseTypeId);
      if (!type) throw new Error(`${label}: jenis endorse tidak ditemukan.`);
      if (s.briefId) {
        const brief = briefs.find((b) => b.id === s.briefId);
        if (!brief || brief.brandId !== data.brandId) {
          throw new Error(`${label}: brief bukan milik brand ini.`);
        }
      }
      for (const pid of s.productIds) {
        const p = productById.get(pid);
        if (!p || p.brandId !== data.brandId) {
          throw new Error(`${label}: produk bukan milik brand ini.`);
        }
      }
      const rate = type.isBarter ? toDecimal(0) : toDecimal(s.rate);
      const additionalCost = toDecimal(s.additionalCost ?? "0");
      return {
        ...s,
        rate,
        additionalCost,
        scheduledAt: s.scheduledAt ? wibInputToDate(s.scheduledAt) : null,
        total: Number(rate) + Number(additionalCost),
      };
    });

    const grandTotal = slots.reduce((acc, s) => acc + s.total, 0);
    if (data.submit) await assertBudgetFits(tx, campaign.budgetId, grandTotal);

    const now = new Date();
    const orderNumber = await nextKolOrderNumber(tx, now);
    const order = await tx.kolScheduleOrder.create({
      data: {
        orderNumber,
        brandId: data.brandId,
        campaignId: campaign.id,
        kolId: kol.id,
        note: data.note,
        requestedById: actorId,
      },
      select: { id: true },
    });

    const scheduleIds: string[] = [];
    for (const [i, s] of slots.entries()) {
      const created = await tx.kolSchedule.create({
        data: {
          orderId: order.id,
          subNumber: kolSubNumber(orderNumber, i),
          brandId: data.brandId,
          campaignId: campaign.id,
          kolId: kol.id,
          socialAccountId: s.socialAccountId,
          placement: s.placement,
          endorseTypeId: s.endorseTypeId,
          objective: s.objective,
          scheduledAt: s.scheduledAt,
          briefId: s.briefId,
          picUserId: s.picUserId ?? actorId,
          rate: s.rate,
          additionalCost: s.additionalCost,
          status: data.submit ? KolScheduleStatus.PENDING_APPROVAL : KolScheduleStatus.DRAFT,
          requestedById: actorId,
          submittedAt: data.submit ? now : null,
          shipmentStatus: s.productIds.length
            ? KolShipmentStatus.PENDING
            : KolShipmentStatus.NOT_REQUIRED,
          products: {
            create: s.productIds.map((productId) => ({
              productId,
              quantity: 1,
              unitValue: productById.get(productId)?.retailPrice ?? null,
            })),
          },
        },
        select: { id: true },
      });
      scheduleIds.push(created.id);
    }

    await logKolAudit(tx, {
      actorId,
      entityType: "order",
      entityId: order.id,
      action: data.submit ? "order.submitted" : "order.drafted",
      meta: { orderNumber, slots: slots.length, total: grandTotal },
    });
    return {
      orderId: order.id,
      orderNumber,
      scheduleIds,
      kolName: kol.fullName,
      campaignTitle: campaign.title,
      grandTotal,
    };
  });

  if (data.submit) {
    await notifyKolApprovers(
      `Jadwal KOL menunggu approval: ${result.kolName} · ${result.scheduleIds.length} slot · ${idr(result.grandTotal)}`,
      actorId,
    );
  }
  revalidateSchedules();
  return result;
}

/** Ajukan slot-slot draf (satu order atau pilihan) — cek budget sekali. */
export async function submitDraftSchedules(scheduleIds: string[]) {
  const session = await requireKolUser();
  const ids = z.array(z.string().min(1)).min(1).parse(scheduleIds);
  const actorId = session.user.id;

  const summary = await prisma.$transaction(async (tx) => {
    const rows = await tx.kolSchedule.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        status: true,
        rate: true,
        additionalCost: true,
        campaign: { select: { budgetId: true } },
        kol: { select: { status: true, fullName: true } },
      },
    });
    if (rows.length !== ids.length) throw new Error("Sebagian jadwal tidak ditemukan.");
    if (rows.some((r) => r.status !== KolScheduleStatus.DRAFT)) {
      throw new Error("Hanya jadwal berstatus draf yang bisa diajukan.");
    }
    const inactive = rows.find((r) => r.kol.status !== KolStatus.ACTIVE);
    if (inactive) throw new Error(`${inactive.kol.fullName} sudah tidak aktif.`);

    const perBudget = new Map<string, number>();
    for (const r of rows) {
      const amt = Number(r.rate) + Number(r.additionalCost);
      perBudget.set(r.campaign.budgetId, (perBudget.get(r.campaign.budgetId) ?? 0) + amt);
    }
    for (const [budgetId, amt] of perBudget) await assertBudgetFits(tx, budgetId, amt);

    const updated = await tx.kolSchedule.updateMany({
      where: { id: { in: ids }, status: KolScheduleStatus.DRAFT },
      data: { status: KolScheduleStatus.PENDING_APPROVAL, submittedAt: new Date() },
    });
    if (updated.count !== ids.length) throw new Error("Status jadwal berubah — muat ulang halaman.");
    for (const id of ids) {
      await logKolAudit(tx, { actorId, entityType: "schedule", entityId: id, action: "schedule.submitted" });
    }
    return {
      count: rows.length,
      kolName: rows[0].kol.fullName,
      total: [...perBudget.values()].reduce((a, b) => a + b, 0),
    };
  });

  await notifyKolApprovers(
    `Jadwal KOL menunggu approval: ${summary.kolName} · ${summary.count} slot · ${idr(summary.total)}`,
    actorId,
  );
  revalidateSchedules();
}

/** Hapus slot draf. Order yang kosong ikut terhapus. */
export async function deleteDraftSchedule(scheduleId: string) {
  const session = await requireKolUser();
  await prisma.$transaction(async (tx) => {
    const s = await tx.kolSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
      select: { orderId: true, status: true, subNumber: true },
    });
    if (s.status !== KolScheduleStatus.DRAFT) {
      throw new Error("Hanya draf yang bisa dihapus — batalkan jadwal yang sudah diajukan.");
    }
    await tx.kolSchedule.delete({ where: { id: scheduleId } });
    const left = await tx.kolSchedule.count({ where: { orderId: s.orderId } });
    if (left === 0) await tx.kolScheduleOrder.delete({ where: { id: s.orderId } });
    await logKolAudit(tx, {
      actorId: session.user.id,
      entityType: "schedule",
      entityId: scheduleId,
      action: "schedule.draft_deleted",
      meta: { subNumber: s.subNumber },
    });
  });
  revalidateSchedules();
}

const CANCELLABLE: KolScheduleStatus[] = [
  KolScheduleStatus.PENDING_APPROVAL,
  KolScheduleStatus.APPROVED,
  KolScheduleStatus.SCHEDULED,
];

/** Batalkan jadwal yang belum tayang. Budget-nya otomatis kembali. */
export async function cancelSchedule(scheduleId: string, reason: string) {
  const session = await requireKolUser();
  const note = z.string().trim().min(3, "Tulis alasan pembatalan.").max(500).parse(reason);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.kolSchedule.updateMany({
      where: { id: scheduleId, status: { in: CANCELLABLE } },
      data: { status: KolScheduleStatus.CANCELLED, decisionNote: note },
    });
    if (updated.count === 0) {
      throw new Error("Jadwal ini sudah tayang atau sudah diputus — tidak bisa dibatalkan.");
    }
    await logKolAudit(tx, {
      actorId: session.user.id,
      entityType: "schedule",
      entityId: scheduleId,
      action: "schedule.cancelled",
      meta: { reason: note },
    });
  });
  revalidateSchedules(scheduleId);
}

/** Tandai jadwal yang sudah disetujui siap tayang (brief & produk beres). */
export async function markScheduleReady(scheduleId: string) {
  const session = await requireKolUser();
  const updated = await prisma.kolSchedule.updateMany({
    where: { id: scheduleId, status: KolScheduleStatus.APPROVED },
    data: { status: KolScheduleStatus.SCHEDULED },
  });
  if (updated.count === 0) throw new Error("Hanya jadwal yang sudah disetujui yang bisa ditandai siap tayang.");
  await logKolAudit(prisma, {
    actorId: session.user.id,
    entityType: "schedule",
    entityId: scheduleId,
    action: "schedule.ready",
  });
  revalidateSchedules(scheduleId);
}

const postSchema = z.object({
  scheduleId: z.string().min(1),
  postUrl: z.string().trim().min(1, "Tempel link post."),
  /** `datetime-local` WIB; kosong = sekarang. */
  postedAt: z.string().optional().nullable(),
});

/**
 * Catat link post → jadwal jadi Tayang, lalu ambil metrik pertamanya.
 * Bisa dipanggil ulang untuk koreksi link.
 */
export async function recordSchedulePost(input: z.input<typeof postSchema>) {
  const session = await requireKolUser();
  const raw = postSchema.parse(input);
  const parsed = parsePostUrl(raw.postUrl);
  const schedule = await prisma.kolSchedule.findUniqueOrThrow({
    where: { id: raw.scheduleId },
    select: { postUrl: true, socialAccount: { select: { platform: true } } },
  });
  if (schedule.socialAccount.platform !== parsed.platform) {
    throw new Error(
      `Jadwal ini untuk akun ${schedule.socialAccount.platform === "TIKTOK" ? "TikTok" : "Instagram"} — link post harus dari platform yang sama.`,
    );
  }
  const data = { ...raw, postUrl: parsed.url };
  const linkChanged = schedule.postUrl !== parsed.url;
  const postedAt = data.postedAt ? wibInputToDate(data.postedAt) : new Date();
  const updated = await prisma.kolSchedule.updateMany({
    where: {
      id: data.scheduleId,
      status: {
        in: [KolScheduleStatus.APPROVED, KolScheduleStatus.SCHEDULED, KolScheduleStatus.POSTED],
      },
    },
    data: {
      status: KolScheduleStatus.POSTED,
      postStatus: KolPostStatus.POSTED,
      postUrl: data.postUrl,
      postedAt,
    },
  });
  if (updated.count === 0) {
    throw new Error("Link post hanya bisa dicatat untuk jadwal yang sudah disetujui.");
  }
  await logKolAudit(prisma, {
    actorId: session.user.id,
    entityType: "schedule",
    entityId: data.scheduleId,
    action: "schedule.posted",
    meta: { postUrl: data.postUrl },
  });
  if (linkChanged) {
    // Link baru = post lain: snapshot lama tidak berlaku lagi.
    await prisma.kolPostSnapshot.deleteMany({ where: { scheduleId: data.scheduleId } });
  }
  try {
    await enqueueKolPostSync({ scheduleIds: [data.scheduleId], force: true });
  } catch (err) {
    // Gagal mengantre bukan alasan menggagalkan pencatatan link — cron akan menyusul.
    console.error("[kol] enqueue first sync", err);
  }
  revalidateSchedules(data.scheduleId);
}

/** Tandai konten diturunkan KOL (tetap dihitung biaya, tapi tercatat). */
export async function markPostTakenDown(scheduleId: string) {
  const session = await requireKolUser();
  const updated = await prisma.kolSchedule.updateMany({
    where: { id: scheduleId, status: KolScheduleStatus.POSTED },
    data: { postStatus: KolPostStatus.TAKEN_DOWN },
  });
  if (updated.count === 0) throw new Error("Hanya jadwal yang sudah tayang.");
  await logKolAudit(prisma, {
    actorId: session.user.id,
    entityType: "schedule",
    entityId: scheduleId,
    action: "schedule.taken_down",
  });
  revalidateSchedules(scheduleId);
}

const shipmentSchema = z.object({
  scheduleId: z.string().min(1),
  status: z.enum(["NOT_REQUIRED", "PENDING", "SHIPPED", "DELIVERED"]),
  courier: z.string().trim().max(60).optional().nullable(),
  trackingNumber: z.string().trim().max(80).optional().nullable(),
});

export async function updateScheduleShipment(input: z.input<typeof shipmentSchema>) {
  const session = await requireKolUser();
  const data = shipmentSchema.parse(input);
  await prisma.kolSchedule.update({
    where: { id: data.scheduleId },
    data: {
      shipmentStatus: data.status,
      courier: data.courier || null,
      trackingNumber: data.trackingNumber || null,
    },
  });
  await logKolAudit(prisma, {
    actorId: session.user.id,
    entityType: "schedule",
    entityId: data.scheduleId,
    action: "schedule.shipment",
    meta: { status: data.status, courier: data.courier ?? null },
  });
  revalidateSchedules(data.scheduleId);
}

const logisticsSchema = z.object({
  scheduleId: z.string().min(1),
  scheduledAt: z.string().optional().nullable(),
  briefId: z.string().optional().nullable(),
  picUserId: z.string().optional().nullable(),
});

/**
 * Ubah tanggal tayang / brief / PIC. Nominal tidak bisa diubah setelah
 * diajukan — batalkan & ajukan ulang supaya approval tetap bermakna.
 */
export async function updateScheduleLogistics(input: z.input<typeof logisticsSchema>) {
  const session = await requireKolUser();
  const data = logisticsSchema.parse(input);
  const s = await prisma.kolSchedule.findUniqueOrThrow({
    where: { id: data.scheduleId },
    select: { status: true, brandId: true },
  });
  const editable: KolScheduleStatus[] = [
    KolScheduleStatus.DRAFT,
    KolScheduleStatus.PENDING_APPROVAL,
    KolScheduleStatus.APPROVED,
    KolScheduleStatus.SCHEDULED,
  ];
  if (!editable.includes(s.status)) throw new Error("Jadwal ini sudah final.");
  if (data.briefId) {
    const brief = await prisma.kolBrief.findUnique({
      where: { id: data.briefId },
      select: { brandId: true },
    });
    if (!brief || brief.brandId !== s.brandId) throw new Error("Brief bukan milik brand ini.");
  }
  const patch: Prisma.KolScheduleUncheckedUpdateInput = {
    scheduledAt: data.scheduledAt ? wibInputToDate(data.scheduledAt) : null,
    briefId: data.briefId || null,
    picUserId: data.picUserId || null,
  };
  await prisma.kolSchedule.update({ where: { id: data.scheduleId }, data: patch });
  await logKolAudit(prisma, {
    actorId: session.user.id,
    entityType: "schedule",
    entityId: data.scheduleId,
    action: "schedule.logistics",
    meta: { scheduledAt: data.scheduledAt ?? null },
  });
  revalidateSchedules(data.scheduleId);
}
