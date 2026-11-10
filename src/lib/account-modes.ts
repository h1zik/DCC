import { cache } from "react";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Mode akun — satu akun boleh berpindah ke beberapa peran kustom.
 *
 * Model datanya sengaja tipis:
 * - Mode AKTIF selalu ditulis ke `User.role` + `User.customRoleId`, kolom yang
 *   sudah menjadi sumber kebenaran proxy, sidebar, guard, dan kapabilitas Lab.
 *   Karena itu tidak ada pengecekan akses yang perlu tahu soal "mode".
 * - `User.primaryCustomRoleId` hanya terisi selagi akun berada di mode lain;
 *   peran utama efektif = `primaryCustomRoleId ?? customRoleId`.
 * - `UserModeGrant` = peran tambahan yang boleh dimasuki (diatur admin).
 */

export type AccountMode = {
  id: string;
  name: string;
  permissionTier: UserRole;
  isPrimary: boolean;
};

export type AccountModes = {
  /** `customRoleId` yang sedang aktif. */
  activeId: string | null;
  /** Peran utama + mode tambahan. Panjang ≤ 1 berarti tidak ada pilihan. */
  modes: AccountMode[];
};

export const NO_ACCOUNT_MODES: AccountModes = { activeId: null, modes: [] };

/** Tier CEO & Administrator tidak pernah boleh menjadi mode tambahan. */
export function isModeEligibleTier(tier: UserRole): boolean {
  return tier !== UserRole.CEO && tier !== UserRole.ADMINISTRATOR;
}

const roleSelect = { id: true, name: true, permissionTier: true } as const;

/** Daftar mode yang boleh dimasuki sebuah akun (untuk pemilih mode). */
export const getAccountModes = cache(
  async (userId: string): Promise<AccountModes> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        customRoleId: true,
        customRole: { select: roleSelect },
        primaryCustomRole: { select: roleSelect },
        modeGrants: {
          select: { customRole: { select: roleSelect } },
          orderBy: { customRole: { name: "asc" } },
        },
      },
    });
    if (!user) return NO_ACCOUNT_MODES;

    const primary = user.primaryCustomRole ?? user.customRole;
    if (!primary) return NO_ACCOUNT_MODES;

    const modes: AccountMode[] = [{ ...primary, isPrimary: true }];
    for (const { customRole } of user.modeGrants) {
      if (customRole.id === primary.id) continue;
      if (!isModeEligibleTier(customRole.permissionTier)) continue;
      modes.push({ ...customRole, isPrimary: false });
    }
    return { activeId: user.customRoleId, modes };
  },
);

/**
 * Pindahkan akun ke salah satu modenya. Divalidasi penuh terhadap DB di dalam
 * transaksi — pemanggil cukup memastikan `userId` adalah pemilik sesi.
 * Mengembalikan tier peran yang kini aktif.
 */
export async function switchUserMode(
  userId: string,
  targetRoleId: string,
): Promise<{ permissionTier: UserRole; name: string }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        customRoleId: true,
        primaryCustomRoleId: true,
        modeGrants: { select: { customRoleId: true } },
      },
    });
    if (!user) throw new Error("Pengguna tidak ditemukan.");

    const primaryId = user.primaryCustomRoleId ?? user.customRoleId;
    if (!primaryId) {
      throw new Error("Akun ini belum punya peran utama.");
    }

    const target = await tx.customRole.findUnique({
      where: { id: targetRoleId },
      select: roleSelect,
    });
    if (!target) throw new Error("Mode tidak ditemukan.");

    const toPrimary = target.id === primaryId;
    if (!toPrimary) {
      const granted = user.modeGrants.some(
        (g) => g.customRoleId === target.id,
      );
      if (!granted || !isModeEligibleTier(target.permissionTier)) {
        throw new Error("Akun Anda tidak punya akses ke mode ini.");
      }
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        role: target.permissionTier,
        customRoleId: target.id,
        primaryCustomRoleId: toPrimary ? null : primaryId,
      },
    });
    return { permissionTier: target.permissionTier, name: target.name };
  });
}

/**
 * Ganti seluruh daftar mode tambahan sebuah akun. Bila mode yang sedang aktif
 * ikut dicabut, akun dikembalikan ke peran utamanya.
 */
export async function replaceUserModeGrants(input: {
  userId: string;
  customRoleIds: string[];
  grantedById: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: {
        role: true,
        customRoleId: true,
        primaryCustomRoleId: true,
        primaryCustomRole: { select: roleSelect },
      },
    });
    if (!user) throw new Error("Pengguna tidak ditemukan.");
    if (user.role === UserRole.CEO) {
      throw new Error("Akun CEO tidak dapat diberi mode tambahan.");
    }

    const primaryId = user.primaryCustomRoleId ?? user.customRoleId;
    const wanted = [...new Set(input.customRoleIds)].filter(
      (id) => id !== primaryId,
    );
    if (wanted.length > 0 && !primaryId) {
      throw new Error("Tetapkan peran utama dulu sebelum memberi mode tambahan.");
    }

    const roles = await tx.customRole.findMany({
      where: { id: { in: wanted } },
      select: roleSelect,
    });
    if (roles.length !== wanted.length) {
      throw new Error("Sebagian peran tidak ditemukan.");
    }
    const blocked = roles.find((r) => !isModeEligibleTier(r.permissionTier));
    if (blocked) {
      throw new Error(
        `Peran "${blocked.name}" bertier CEO/Administrator dan tidak bisa dijadikan mode tambahan.`,
      );
    }

    await tx.userModeGrant.deleteMany({
      where: { userId: input.userId, customRoleId: { notIn: wanted } },
    });
    await tx.userModeGrant.createMany({
      data: wanted.map((customRoleId) => ({
        userId: input.userId,
        customRoleId,
        grantedById: input.grantedById,
      })),
      skipDuplicates: true,
    });

    // Sedang berada di mode yang baru saja dicabut → pulang ke peran utama.
    const inRevokedMode =
      user.primaryCustomRoleId !== null &&
      user.customRoleId !== null &&
      !wanted.includes(user.customRoleId);
    if (inRevokedMode && user.primaryCustomRole) {
      await tx.user.update({
        where: { id: input.userId },
        data: {
          role: user.primaryCustomRole.permissionTier,
          customRoleId: user.primaryCustomRole.id,
          primaryCustomRoleId: null,
        },
      });
    }
  });
}
