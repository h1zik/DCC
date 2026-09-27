"use server";

import { KolChangeStatus, KolChangeType, KolStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enqueueInfluencerAudit } from "@/lib/brand-research/influencer/run-audit";
import { canApproveKol, requireKolUser } from "@/lib/kol/auth";
import { logKolAudit } from "@/lib/kol/audit";
import { notifyKolApprovers } from "@/lib/kol/notify";
import {
  applyKolProfileData,
  assertAccountsAvailable,
  createKolProfileRow,
  normalizeAccounts,
} from "@/lib/kol/profile-apply";
import { kolProfileInputSchema, type KolProfileInput } from "@/lib/kol/validation";
import { prisma } from "@/lib/prisma";

function revalidateKol(id?: string) {
  revalidatePath("/kol-hub");
  revalidatePath("/kol-hub/kols");
  revalidatePath("/kol-hub/approvals");
  if (id) revalidatePath(`/kol-hub/kols/${id}`);
}

/** Tambah KOL baru → menunggu approval. */
export async function createKolProfile(input: KolProfileInput) {
  const session = await requireKolUser();
  const data = kolProfileInputSchema.parse(input);
  const actorId = session.user.id;

  const id = await prisma.$transaction(async (tx) => {
    const kolId = await createKolProfileRow(tx, data, actorId);
    await tx.kolProfileChangeRequest.create({
      data: { kolId, type: KolChangeType.CREATE, requestedById: actorId },
    });
    await logKolAudit(tx, {
      actorId,
      entityType: "profile",
      entityId: kolId,
      action: "profile.create",
    });
    return kolId;
  });

  await notifyKolApprovers(`KOL baru menunggu approval: ${data.fullName}`, actorId);
  revalidateKol(id);
  return { id };
}

/**
 * Simpan perubahan profil.
 *
 * - Profil yang belum aktif (menunggu / ditolak) langsung diperbarui; profil
 *   yang ditolak sekaligus diajukan ulang.
 * - Profil aktif / blacklist: perubahan jadi pengajuan EDIT dan baru berlaku
 *   setelah disetujui approver.
 */
export async function updateKolProfile(kolId: string, input: KolProfileInput) {
  const session = await requireKolUser();
  const data = kolProfileInputSchema.parse(input);
  const actorId = session.user.id;
  const approver = await canApproveKol();

  const result = await prisma.$transaction(async (tx) => {
    const kol = await tx.kolProfile.findUniqueOrThrow({
      where: { id: kolId },
      select: { status: true, fullName: true, phone: true, accountNumber: true },
    });
    // Non-approver tidak pernah melihat HP & rekening lengkap (form dikirim
    // kosong) — field kosong berarti "tetap", bukan "hapus".
    if (!approver) {
      if (!data.phone) data.phone = kol.phone;
      if (!data.accountNumber) data.accountNumber = kol.accountNumber;
    }
    const pending = await tx.kolProfileChangeRequest.findFirst({
      where: { kolId, status: KolChangeStatus.PENDING },
      select: { id: true, type: true },
    });

    if (kol.status === KolStatus.WAITING_APPROVAL || kol.status === KolStatus.REJECTED) {
      await applyKolProfileData(tx, kolId, data, actorId);
      if (kol.status === KolStatus.REJECTED) {
        if (pending) throw new Error("Profil ini masih punya pengajuan yang belum diputus.");
        await tx.kolProfile.update({
          where: { id: kolId },
          data: { status: KolStatus.WAITING_APPROVAL },
        });
        await tx.kolProfileChangeRequest.create({
          data: { kolId, type: KolChangeType.CREATE, requestedById: actorId },
        });
      }
      await logKolAudit(tx, {
        actorId,
        entityType: "profile",
        entityId: kolId,
        action: kol.status === KolStatus.REJECTED ? "profile.resubmit" : "profile.update",
      });
      return { mode: "applied" as const, resubmitted: kol.status === KolStatus.REJECTED };
    }

    if (pending) {
      throw new Error(
        "Profil ini masih punya pengajuan yang menunggu approval. Tunggu diputus atau batalkan dulu.",
      );
    }
    // Validasi sekarang supaya bentrok akun ketahuan sebelum masuk antrean.
    await assertAccountsAvailable(tx, normalizeAccounts(data), kolId);
    const req = await tx.kolProfileChangeRequest.create({
      data: {
        kolId,
        type: KolChangeType.EDIT,
        payload: data,
        requestedById: actorId,
      },
      select: { id: true },
    });
    await logKolAudit(tx, {
      actorId,
      entityType: "change_request",
      entityId: req.id,
      action: "profile.edit_requested",
      meta: { kolId },
    });
    return { mode: "requested" as const, resubmitted: false };
  });

  if (result.mode === "requested") {
    await notifyKolApprovers(`Perubahan data KOL menunggu approval: ${data.fullName}`, actorId);
  } else if (result.resubmitted) {
    await notifyKolApprovers(`KOL diajukan ulang: ${data.fullName}`, actorId);
  }
  revalidateKol(kolId);
  return result;
}

const statusRequestSchema = z.object({
  kolId: z.string().min(1),
  reason: z.string().trim().min(3, "Tulis alasannya (minimal 3 huruf).").max(500),
});

/** Ajukan blacklist (dari ACTIVE) atau buka blacklist (dari BLACKLISTED). */
export async function requestKolStatusChange(
  input: z.input<typeof statusRequestSchema> & { type: "BLACKLIST" | "UNBLACKLIST" },
) {
  const session = await requireKolUser();
  const data = statusRequestSchema.parse(input);
  const type = input.type === "BLACKLIST" ? KolChangeType.BLACKLIST : KolChangeType.UNBLACKLIST;
  const actorId = session.user.id;

  const name = await prisma.$transaction(async (tx) => {
    const kol = await tx.kolProfile.findUniqueOrThrow({
      where: { id: data.kolId },
      select: { status: true, fullName: true },
    });
    const expected =
      type === KolChangeType.BLACKLIST ? KolStatus.ACTIVE : KolStatus.BLACKLISTED;
    if (kol.status !== expected) {
      throw new Error(
        type === KolChangeType.BLACKLIST
          ? "Hanya KOL aktif yang bisa diajukan blacklist."
          : "KOL ini tidak sedang di-blacklist.",
      );
    }
    const pending = await tx.kolProfileChangeRequest.count({
      where: { kolId: data.kolId, status: KolChangeStatus.PENDING },
    });
    if (pending) throw new Error("Masih ada pengajuan lain untuk KOL ini.");
    const req = await tx.kolProfileChangeRequest.create({
      data: { kolId: data.kolId, type, reason: data.reason, requestedById: actorId },
      select: { id: true },
    });
    await logKolAudit(tx, {
      actorId,
      entityType: "change_request",
      entityId: req.id,
      action: type === KolChangeType.BLACKLIST ? "profile.blacklist_requested" : "profile.unblacklist_requested",
      meta: { kolId: data.kolId, reason: data.reason },
    });
    return kol.fullName;
  });

  await notifyKolApprovers(
    `${type === KolChangeType.BLACKLIST ? "Pengajuan blacklist" : "Pengajuan buka blacklist"}: ${name}`,
    actorId,
  );
  revalidateKol(data.kolId);
}

/** Pengaju membatalkan pengajuannya sendiri yang belum diputus. */
export async function cancelKolChangeRequest(requestId: string) {
  const session = await requireKolUser();
  const req = await prisma.kolProfileChangeRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { kolId: true, type: true, requestedById: true, status: true },
  });
  if (req.requestedById !== session.user.id) {
    throw new Error("Hanya pengaju yang bisa membatalkan pengajuan ini.");
  }
  if (req.type === KolChangeType.CREATE) {
    throw new Error("Pengajuan profil baru tidak bisa dibatalkan — hapus profilnya saja.");
  }
  const updated = await prisma.kolProfileChangeRequest.updateMany({
    where: { id: requestId, status: KolChangeStatus.PENDING },
    data: {
      status: KolChangeStatus.REJECTED,
      decidedById: session.user.id,
      decidedAt: new Date(),
      decisionNote: "Dibatalkan pengaju.",
    },
  });
  if (updated.count === 0) throw new Error("Pengajuan ini sudah diputus.");
  await logKolAudit(prisma, {
    actorId: session.user.id,
    entityType: "change_request",
    entityId: requestId,
    action: "change.cancelled",
  });
  revalidateKol(req.kolId);
}

/** Hapus profil yang belum pernah aktif & belum punya jadwal. */
export async function deleteKolProfile(kolId: string) {
  const session = await requireKolUser();
  const kol = await prisma.kolProfile.findUniqueOrThrow({
    where: { id: kolId },
    select: {
      status: true,
      fullName: true,
      createdById: true,
      _count: { select: { schedules: true } },
    },
  });
  if (kol._count.schedules > 0) {
    throw new Error("KOL ini sudah punya jadwal — ajukan blacklist alih-alih menghapus.");
  }
  if (kol.status === KolStatus.ACTIVE || kol.status === KolStatus.BLACKLISTED) {
    throw new Error("KOL aktif tidak bisa dihapus — ajukan blacklist bila tidak dipakai lagi.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.kolProfile.delete({ where: { id: kolId } });
    await logKolAudit(tx, {
      actorId: session.user.id,
      entityType: "profile",
      entityId: kolId,
      action: "profile.delete",
      meta: { fullName: kol.fullName },
    });
  });
  revalidateKol();
}

/** Jalankan audit Brand Hub untuk akun KOL (hasil tampil di profil KOL). */
export async function runKolAccountAudit(accountId: string) {
  await requireKolUser();
  const account = await prisma.kolSocialAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { kolId: true, influencerProfileId: true },
  });
  if (!account.influencerProfileId) {
    throw new Error("Akun ini belum tertaut ke profil influencer — simpan ulang profil KOL.");
  }
  await enqueueInfluencerAudit(account.influencerProfileId);
  revalidateKol(account.kolId);
}
