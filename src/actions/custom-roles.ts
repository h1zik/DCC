"use server";

import { revalidatePath } from "next/cache";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/lib/auth-helpers";
import {
  ASSIGNABLE_PERMISSION_TIERS,
  ensureCustomRolesSeeded,
  slugifyRoleName,
} from "@/lib/custom-roles";

const assignableTierSet = new Set<UserRole>(ASSIGNABLE_PERMISSION_TIERS);

const nameSchema = z
  .string()
  .trim()
  .min(2, "Nama peran minimal 2 karakter.")
  .max(80, "Nama peran maksimal 80 karakter.");

const createSchema = z.object({
  name: nameSchema,
  permissionTier: z.nativeEnum(UserRole).refine(
    (t) => assignableTierSet.has(t),
    {
      message: "Tier permission tidak diizinkan.",
    },
  ),
});

const renameSchema = z.object({
  id: z.string().min(1),
  name: nameSchema,
});

const retierSchema = z.object({
  id: z.string().min(1),
  permissionTier: z.nativeEnum(UserRole).refine((t) => assignableTierSet.has(t), {
    message: "Tier permission tidak diizinkan.",
  }),
});

const deleteSchema = z.object({ id: z.string().min(1) });

/**
 * Buat custom role baru. Hanya CEO/Administrator. Memilih tier permission CEO
 * tidak diperbolehkan (perlindungan baseline).
 */
export async function createCustomRole(input: z.infer<typeof createSchema>) {
  await requireAdministrator();
  await ensureCustomRolesSeeded();
  const data = createSchema.parse(input);
  const slug = await uniqueSlug(slugifyRoleName(data.name));
  try {
    const created = await prisma.customRole.create({
      data: {
        name: data.name,
        slug,
        permissionTier: data.permissionTier,
        isProtected: false,
      },
    });
    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");
    return { id: created.id };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("Nama peran sudah dipakai. Pakai nama lain.");
    }
    throw err;
  }
}

/** Ganti nama custom role. Boleh untuk role protected. Slug ikut dirapikan. */
export async function renameCustomRole(input: z.infer<typeof renameSchema>) {
  await requireAdministrator();
  await ensureCustomRolesSeeded();
  const data = renameSchema.parse(input);
  const existing = await prisma.customRole.findUnique({
    where: { id: data.id },
    select: { id: true, slug: true, isProtected: true, name: true },
  });
  if (!existing) throw new Error("Peran tidak ditemukan.");
  if (existing.name === data.name) return;
  // Slug protected role tidak diubah agar lookup seed tetap stabil.
  const nextSlug = existing.isProtected
    ? existing.slug
    : await uniqueSlug(slugifyRoleName(data.name), existing.id);
  try {
    await prisma.customRole.update({
      where: { id: existing.id },
      data: { name: data.name, slug: nextSlug },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("Nama peran sudah dipakai. Pakai nama lain.");
    }
    throw err;
  }
  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
}

/**
 * Ubah tier permission custom role non-protected. User yang memakai role ini
 * akan otomatis ikut tier baru (User.role disesuaikan).
 */
export async function updateCustomRoleTier(input: z.infer<typeof retierSchema>) {
  await requireAdministrator();
  await ensureCustomRolesSeeded();
  const data = retierSchema.parse(input);
  const existing = await prisma.customRole.findUnique({
    where: { id: data.id },
    select: { id: true, isProtected: true, permissionTier: true },
  });
  if (!existing) throw new Error("Peran tidak ditemukan.");
  if (existing.isProtected) {
    throw new Error("Tier peran inti tidak dapat diubah.");
  }
  if (existing.permissionTier === data.permissionTier) return;

  await prisma.$transaction([
    prisma.customRole.update({
      where: { id: data.id },
      data: { permissionTier: data.permissionTier },
    }),
    prisma.user.updateMany({
      where: {
        customRoleId: data.id,
        // Jangan mengubah peran CEO meski terkait (defensive — protected check di atas)
        role: { not: UserRole.CEO },
      },
      data: { role: data.permissionTier },
    }),
  ]);
  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
}

/** Hapus custom role. Tidak boleh untuk role protected atau yang masih dipakai user. */
export async function deleteCustomRole(input: z.infer<typeof deleteSchema>) {
  await requireAdministrator();
  await ensureCustomRolesSeeded();
  const { id } = deleteSchema.parse(input);

  const role = await prisma.customRole.findUnique({
    where: { id },
    select: { id: true, isProtected: true, name: true, _count: { select: { users: true } } },
  });
  if (!role) throw new Error("Peran tidak ditemukan.");
  if (role.isProtected) {
    throw new Error(`Peran inti "${role.name}" tidak dapat dihapus.`);
  }
  if (role._count.users > 0) {
    throw new Error(
      `Peran "${role.name}" masih dipakai ${role._count.users} pengguna. Pindahkan dulu mereka ke peran lain.`,
    );
  }
  await prisma.customRole.delete({ where: { id } });
  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  let suffix = 1;
  // Hindari clash slug
  while (true) {
    const clash = await prisma.customRole.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash || (excludeId && clash.id === excludeId)) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`.slice(0, 80);
    if (suffix > 100) {
      // Pengaman pamungkas
      return `${base.slice(0, 60)}-${Date.now().toString(36)}`;
    }
  }
}
