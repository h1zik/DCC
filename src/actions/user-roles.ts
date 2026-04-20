"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/lib/auth-helpers";

const updateSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(UserRole),
});

/**
 * Mengubah peran pengguna (termasuk menetapkan / mencabut administrator).
 * Hanya CEO — tidak dapat menetapkan CEO atau mengubah akun sendiri.
 */
export async function updateUserRoleByCeo(input: z.infer<typeof updateSchema>) {
  const session = await requireAdministrator();
  const data = updateSchema.parse(input);
  if (data.role === UserRole.CEO) {
    throw new Error("Peran CEO tidak dapat ditetapkan lewat halaman ini.");
  }

  if (data.userId === session.user.id) {
    throw new Error("Anda tidak dapat mengubah peran akun Anda sendiri.");
  }

  const target = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true, role: true },
  });
  if (!target) {
    throw new Error("Pengguna tidak ditemukan.");
  }
  if (target.role === UserRole.CEO) {
    throw new Error("Peran CEO tidak dapat diubah.");
  }

  await prisma.user.update({
    where: { id: data.userId },
    data: { role: data.role },
  });

  revalidatePath("/admin/access");
  revalidatePath("/admin/users");
}
