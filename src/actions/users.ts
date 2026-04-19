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
}
