"use server";

import { revalidatePath } from "next/cache";
import { CapabilityEffect, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/lib/auth-helpers";
import { CAPABILITIES, isCapability } from "@/lib/capabilities";
import { ensureCustomRolesSeeded } from "@/lib/custom-roles";

const capabilitySchema = z
  .string()
  .refine(isCapability, { message: "Kapabilitas tidak dikenal." });

const roleCapabilitiesSchema = z.object({
  roleId: z.string().min(1),
  capabilities: z.array(capabilitySchema).max(CAPABILITIES.length),
});

const userCapabilitySchema = z.object({
  userId: z.string().min(1),
  capability: capabilitySchema,
  /** `null` = hapus override, kembali mengikuti peran. */
  effect: z.nativeEnum(CapabilityEffect).nullable(),
  expiresAt: z.coerce.date().nullish(),
  reason: z.string().trim().max(200).nullish(),
});

function revalidateAccessSurfaces() {
  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
}

/**
 * Setel kapabilitas sebuah peran. Berlaku untuk semua user yang memakainya.
 *
 * Daftar yang dikirim menggantikan isi sebelumnya (bukan menambah), supaya
 * mencabut centang di matriks benar-benar mencabut akses — sekaligus alasan
 * kenapa resolver berhenti memakai matriks tier begitu peran punya kapabilitas.
 */
export async function updateRoleCapabilities(
  input: z.infer<typeof roleCapabilitiesSchema>,
) {
  await requireAdministrator();
  await ensureCustomRolesSeeded();
  const data = roleCapabilitiesSchema.parse(input);

  const role = await prisma.customRole.findUnique({
    where: { id: data.roleId },
    select: { id: true, permissionTier: true, name: true },
  });
  if (!role) throw new Error("Peran tidak ditemukan.");
  if (role.permissionTier === UserRole.CEO) {
    throw new Error("Akses peran CEO tidak dikelola dari halaman ini.");
  }

  await prisma.customRole.update({
    where: { id: role.id },
    data: {
      capabilities: [...new Set(data.capabilities)],
      // Tandai sudah ditentukan manusia — seeder tidak boleh menyentuhnya lagi.
      capabilitiesSeededAt: new Date(),
    },
  });
  revalidateAccessSurfaces();
}

/**
 * Beri, cabut, atau bersihkan satu kapabilitas untuk satu orang.
 *
 * `effect: null` menghapus barisnya sehingga user kembali murni mengikuti
 * perannya. ALLOW menambah di atas peran, DENY mencabut meski perannya punya.
 */
export async function setUserCapability(
  input: z.infer<typeof userCapabilitySchema>,
) {
  const session = await requireAdministrator();
  const data = userCapabilitySchema.parse(input);

  // Cermin penjagaan di `updateUserRoleByCeo`: administrator tidak boleh
  // mengutak-atik aksesnya sendiri — mencegah terkunci di luar sistem sendiri.
  if (data.userId === session.user.id) {
    throw new Error("Anda tidak dapat mengubah akses akun Anda sendiri.");
  }

  const target = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true, role: true },
  });
  if (!target) throw new Error("Pengguna tidak ditemukan.");
  if (target.role === UserRole.CEO) {
    throw new Error("Akses akun CEO tidak dapat diubah.");
  }

  if (data.effect === null) {
    await prisma.userCapability.deleteMany({
      where: { userId: data.userId, capability: data.capability },
    });
    revalidateAccessSurfaces();
    return;
  }

  const expiresAt = data.expiresAt ?? null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new Error("Tanggal kedaluwarsa harus di masa depan.");
  }
  const reason = data.reason?.trim() || null;

  await prisma.userCapability.upsert({
    where: {
      userId_capability: {
        userId: data.userId,
        capability: data.capability,
      },
    },
    create: {
      userId: data.userId,
      capability: data.capability,
      effect: data.effect,
      expiresAt,
      reason,
      grantedById: session.user.id,
    },
    update: {
      effect: data.effect,
      expiresAt,
      reason,
      grantedById: session.user.id,
    },
  });
  revalidateAccessSurfaces();
}

/** Hapus semua override seorang user — kembali sepenuhnya mengikuti perannya. */
export async function clearUserCapabilities(input: { userId: string }) {
  const session = await requireAdministrator();
  const userId = z.string().min(1).parse(input.userId);
  if (userId === session.user.id) {
    throw new Error("Anda tidak dapat mengubah akses akun Anda sendiri.");
  }
  await prisma.userCapability.deleteMany({ where: { userId } });
  revalidateAccessSurfaces();
}
