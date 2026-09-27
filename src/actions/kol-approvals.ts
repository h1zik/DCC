"use server";

import {
  KolChangeStatus,
  KolChangeType,
  KolScheduleStatus,
  KolStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertNotSelfApproval, requireKolApprover } from "@/lib/kol/auth";
import { logKolAudit } from "@/lib/kol/audit";
import { notifyKolRequester } from "@/lib/kol/notify";
import { applyKolProfileData } from "@/lib/kol/profile-apply";
import { kolProfileInputSchema } from "@/lib/kol/validation";
import { prisma } from "@/lib/prisma";

function revalidateAll(kolId?: string) {
  revalidatePath("/kol-hub");
  revalidatePath("/kol-hub/approvals");
  revalidatePath("/kol-hub/kols");
  revalidatePath("/kol-hub/schedules");
  revalidatePath("/kol-hub/calendar");
  if (kolId) revalidatePath(`/kol-hub/kols/${kolId}`);
}

const decisionSchema = z.object({
  id: z.string().min(1),
  note: z.string().trim().max(500).optional().nullable(),
});

const CHANGE_LABEL: Record<KolChangeType, string> = {
  CREATE: "Profil KOL",
  EDIT: "Perubahan data KOL",
  BLACKLIST: "Pengajuan blacklist",
  UNBLACKLIST: "Pengajuan buka blacklist",
};

/** Putuskan pengajuan profil KOL. */
export async function decideKolChange(
  input: z.input<typeof decisionSchema> & { approve: boolean },
) {
  const session = await requireKolApprover();
  const data = decisionSchema.parse(input);
  if (!input.approve && !data.note) {
    throw new Error("Tulis alasan penolakan supaya pengaju tahu apa yang perlu diperbaiki.");
  }
  const actorId = session.user.id;
  const now = new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    const req = await tx.kolProfileChangeRequest.findUniqueOrThrow({
      where: { id: data.id },
      select: {
        id: true,
        kolId: true,
        type: true,
        payload: true,
        reason: true,
        status: true,
        requestedById: true,
        kol: { select: { fullName: true, status: true } },
      },
    });
    assertNotSelfApproval(req.requestedById, actorId);

    // Compare-and-set: dua approver yang menekan bersamaan tidak dobel.
    const claimed = await tx.kolProfileChangeRequest.updateMany({
      where: { id: req.id, status: KolChangeStatus.PENDING },
      data: {
        status: input.approve ? KolChangeStatus.APPROVED : KolChangeStatus.REJECTED,
        decidedById: actorId,
        decidedAt: now,
        decisionNote: data.note || null,
      },
    });
    if (claimed.count === 0) throw new Error("Pengajuan ini sudah diputus.");

    if (input.approve) {
      switch (req.type) {
        case KolChangeType.CREATE:
          await tx.kolProfile.update({
            where: { id: req.kolId },
            data: { status: KolStatus.ACTIVE, approvedById: actorId, approvedAt: now },
          });
          break;
        case KolChangeType.EDIT: {
          const payload = kolProfileInputSchema.parse(req.payload);
          await applyKolProfileData(tx, req.kolId, payload, actorId);
          break;
        }
        case KolChangeType.BLACKLIST:
          await tx.kolProfile.update({
            where: { id: req.kolId },
            data: { status: KolStatus.BLACKLISTED, blacklistReason: req.reason },
          });
          break;
        case KolChangeType.UNBLACKLIST:
          await tx.kolProfile.update({
            where: { id: req.kolId },
            data: { status: KolStatus.ACTIVE, blacklistReason: null },
          });
          break;
      }
    } else if (req.type === KolChangeType.CREATE) {
      await tx.kolProfile.update({
        where: { id: req.kolId },
        data: { status: KolStatus.REJECTED },
      });
    }

    await logKolAudit(tx, {
      actorId,
      entityType: "change_request",
      entityId: req.id,
      action: input.approve ? "change.approved" : "change.rejected",
      meta: { kolId: req.kolId, type: req.type, note: data.note ?? null },
    });
    return {
      kolId: req.kolId,
      requestedById: req.requestedById,
      message: `${CHANGE_LABEL[req.type]} ${req.kol.fullName} ${input.approve ? "disetujui" : "ditolak"}${data.note ? `: ${data.note}` : ""}`,
    };
  });

  await notifyKolRequester(outcome.requestedById, outcome.message);
  revalidateAll(outcome.kolId);
}

const scheduleDecisionSchema = z.object({
  scheduleIds: z.array(z.string().min(1)).min(1).max(50),
  note: z.string().trim().max(500).optional().nullable(),
});

/**
 * Putuskan satu atau beberapa slot sekaligus (mis. seluruh order).
 * Semua slot harus masih menunggu approval & bukan milik approver sendiri.
 */
export async function decideSchedules(
  input: z.input<typeof scheduleDecisionSchema> & { approve: boolean },
) {
  const session = await requireKolApprover();
  const data = scheduleDecisionSchema.parse(input);
  if (!input.approve && !data.note) {
    throw new Error("Tulis alasan penolakan supaya pengaju tahu apa yang perlu diperbaiki.");
  }
  const actorId = session.user.id;
  const now = new Date();

  const notices = await prisma.$transaction(async (tx) => {
    const rows = await tx.kolSchedule.findMany({
      where: { id: { in: data.scheduleIds } },
      select: {
        id: true,
        status: true,
        subNumber: true,
        requestedById: true,
        kol: { select: { fullName: true, status: true } },
        socialAccount: {
          select: { influencerProfile: { select: { latestFollowers: true } } },
        },
      },
    });
    if (rows.length !== data.scheduleIds.length) throw new Error("Sebagian jadwal tidak ditemukan.");
    for (const r of rows) assertNotSelfApproval(r.requestedById, actorId);
    if (input.approve) {
      const inactive = rows.find((r) => r.kol.status !== KolStatus.ACTIVE);
      if (inactive) {
        throw new Error(`${inactive.kol.fullName} sudah tidak aktif — tolak jadwalnya.`);
      }
    }

    const updated = await tx.kolSchedule.updateMany({
      where: { id: { in: data.scheduleIds }, status: KolScheduleStatus.PENDING_APPROVAL },
      data: {
        status: input.approve ? KolScheduleStatus.APPROVED : KolScheduleStatus.REJECTED,
        decidedById: actorId,
        decidedAt: now,
        decisionNote: data.note || null,
      },
    });
    if (updated.count !== rows.length) {
      throw new Error("Sebagian jadwal sudah diputus orang lain — muat ulang halaman.");
    }
    if (input.approve) {
      // Follower saat disetujui — pembanding performa setelah tayang.
      for (const r of rows) {
        const followers = r.socialAccount.influencerProfile?.latestFollowers;
        if (followers != null) {
          await tx.kolSchedule.update({
            where: { id: r.id },
            data: { followersAtBooking: followers },
          });
        }
      }
    }
    for (const r of rows) {
      await logKolAudit(tx, {
        actorId,
        entityType: "schedule",
        entityId: r.id,
        action: input.approve ? "schedule.approved" : "schedule.rejected",
        meta: { note: data.note ?? null },
      });
    }

    const byRequester = new Map<string, { kol: string; count: number }>();
    for (const r of rows) {
      if (!r.requestedById) continue;
      const cur = byRequester.get(r.requestedById) ?? { kol: r.kol.fullName, count: 0 };
      cur.count += 1;
      byRequester.set(r.requestedById, cur);
    }
    return [...byRequester.entries()];
  });

  for (const [userId, n] of notices) {
    await notifyKolRequester(
      userId,
      `${n.count} jadwal ${n.kol} ${input.approve ? "disetujui" : "ditolak"}${data.note ? `: ${data.note}` : ""}`,
    );
  }
  revalidateAll();
}
