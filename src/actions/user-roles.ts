"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/lib/auth-helpers";
import { ensureCustomRolesSeeded } from "@/lib/custom-roles";

const updateSchema = z.object({
  userId: z.string().min(1),
  customRoleId: z.string().min(1, "Pilih peran."),
});

/**
 * Mengubah peran pengguna lewat custom role. Permission tier (`User.role` enum)
 * otomatis disesuaikan dengan tier custom role yang dipilih. Tidak dapat
 * menetapkan custom role dengan tier CEO atau mengubah akun CEO sendiri.
 */
export async function updateUserRoleByCeo(input: z.infer<typeof updateSchema>) {
  const session = await requireAdministrator();
  await ensureCustomRolesSeeded();
  const data = updateSchema.parse(input);

  if (data.userId === session.user.id) {
    throw new Error("Anda tidak dapat mengubah peran akun Anda sendiri.");
  }

  const role = await prisma.customRole.findUnique({
    where: { id: data.customRoleId },
    select: { id: true, permissionTier: true, name: true },
  });
  if (!role) throw new Error("Peran tidak ditemukan.");
  if (role.permissionTier === UserRole.CEO) {
    throw new Error("Peran CEO tidak dapat ditetapkan lewat halaman ini.");
  }

  const target = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true, role: true },
  });
  if (!target) throw new Error("Pengguna tidak ditemukan.");
  if (target.role === UserRole.CEO) {
    throw new Error("Peran CEO tidak dapat diubah.");
  }

  await prisma.user.update({
    where: { id: data.userId },
    data: {
      role: role.permissionTier,
      customRoleId: role.id,
    },
  });

  revalidatePath("/admin/access");
  revalidatePath("/admin/users");
}
