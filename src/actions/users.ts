"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCeo } from "@/lib/auth-helpers";
import { CEO_ASSIGNABLE_USER_ROLES } from "@/lib/ceo-assignable-roles";

const assignableSet = new Set<UserRole>(CEO_ASSIGNABLE_USER_ROLES);

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
  role: z.nativeEnum(UserRole).refine((r) => assignableSet.has(r), {
    message: "Peran tidak diizinkan untuk pengguna baru.",
  }),
});

/**
 * Membuat pengguna internal baru. Hanya CEO; peran CEO tidak tersedia.
 */
export async function createUserByCeo(
  input: z.infer<typeof createUserSchema>,
) {
  await requireCeo();
  const data = createUserSchema.parse(input);

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
      role: data.role,
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
  await requireCeo();
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
  await requireCeo();
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
  const session = await requireCeo();
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
