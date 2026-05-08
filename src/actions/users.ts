"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/lib/auth-helpers";
import { ensureCustomRolesSeeded } from "@/lib/custom-roles";

const createUserSchema = z.object({
  email: z
    .string()
    .email("Format email tidak valid.")
    .transform((s) => s.trim().toLowerCase()),
  name: z
    .string()
    .max(120)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter.")
    .max(128, "Kata sandi terlalu panjang."),
  customRoleId: z.string().min(1, "Pilih peran."),
});

/**
 * Membuat pengguna internal baru. Hanya CEO/Administrator. Peran CEO tidak
 * dapat ditetapkan dari UI ini (perlindungan baseline).
 */
export async function createUserByCeo(
  input: z.infer<typeof createUserSchema>,
) {
  await requireAdministrator();
  await ensureCustomRolesSeeded();
  const data = createUserSchema.parse(input);

  const role = await prisma.customRole.findUnique({
    where: { id: data.customRoleId },
    select: { id: true, permissionTier: true, name: true },
  });
  if (!role) throw new Error("Peran tidak ditemukan.");
  if (role.permissionTier === UserRole.CEO) {
    throw new Error("Peran CEO tidak dapat ditetapkan dari halaman ini.");
  }

  const exists = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (exists) {
    throw new Error("Email sudah terdaftar.");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.user.create({
    data: {
      email: data.email,
      name: data.name ?? null,
      passwordHash,
      role: role.permissionTier,
      customRoleId: role.id,
    },
  });

  revalidatePath("/admin/access");
  revalidatePath("/admin/users/new");
  revalidatePath("/admin/users");
}

const updateUserDetailsSchema = z.object({
  userId: z.string().min(1),
  email: z
    .string()
    .email("Format email tidak valid.")
    .transform((s) => s.trim().toLowerCase()),
  name: z.string().max(120),
});

/**
 * Memperbarui email & nama pengguna. Hanya CEO.
 */
export async function updateUserDetailsByCeo(
  input: z.infer<typeof updateUserDetailsSchema>,
) {
  await requireAdministrator();
  const data = updateUserDetailsSchema.parse(input);

  const target = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true, email: true },
  });
  if (!target) {
    throw new Error("Pengguna tidak ditemukan.");
  }

  if (data.email !== target.email) {
    const clash = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (clash && clash.id !== data.userId) {
      throw new Error("Email sudah dipakai pengguna lain.");
    }
  }

  const name = data.name.trim() ? data.name.trim() : null;

  await prisma.user.update({
    where: { id: data.userId },
    data: {
      email: data.email,
      name,
    },
  });

  revalidatePath("/admin/access");
  revalidatePath("/admin/users");
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter.")
    .max(128, "Kata sandi terlalu panjang."),
});

/** Mengatur ulang kata sandi pengguna. Hanya CEO. */
export async function resetUserPasswordByCeo(
  input: z.infer<typeof resetPasswordSchema>,
) {
  await requireAdministrator();
  const data = resetPasswordSchema.parse(input);

  const exists = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true },
  });
  if (!exists) {
    throw new Error("Pengguna tidak ditemukan.");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.user.update({
    where: { id: data.userId },
    data: { passwordHash },
  });

  revalidatePath("/admin/users");
}

const deleteUserSchema = z.object({
  userId: z.string().min(1),
});

/** Menghapus pengguna. CEO tidak dapat menghapus diri sendiri atau akun CEO lain. */
export async function deleteUserByCeo(input: z.infer<typeof deleteUserSchema>) {
  const session = await requireAdministrator();
  const { userId } = deleteUserSchema.parse(input);

  if (userId === session.user.id) {
    throw new Error("Anda tidak dapat menghapus akun Anda sendiri.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) {
    throw new Error("Pengguna tidak ditemukan.");
  }
  if (target.role === UserRole.CEO) {
    throw new Error("Akun CEO tidak dapat dihapus.");
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    throw new Error(
      "Tidak dapat menghapus pengguna (masih terikat data). Coba hubungi pengembang.",
    );
  }

  revalidatePath("/admin/access");
  revalidatePath("/admin/users");
}
