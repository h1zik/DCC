import "server-only";

import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export {
  ASSIGNABLE_PERMISSION_TIERS,
  PROTECTED_ROLE_SLUGS,
  effectiveRoleLabel,
  enumRoleLabel,
  permissionTierLabel,
  slugifyRoleName,
} from "@/lib/role-labels";

/**
 * Definisi seed untuk Custom Role bawaan.
 *
 * - 4 role inti `isProtected = true` selalu ada dan tidak bisa dihapus.
 * - 5 role tambahan (Marketing, Creative Director, dll) di-seed sekali agar
 *   user existing punya label yang konsisten — tetap boleh dihapus/diganti
 *   nama setelah seed.
 */
type SeedRole = {
  slug: string;
  name: string;
  permissionTier: UserRole;
  isProtected: boolean;
  /**
   * Daftar tier enum yang harus dianggap "milik" custom role ini saat backfill
   * user existing.
   */
  matchesEnum: UserRole[];
};

export const CUSTOM_ROLE_SEED: SeedRole[] = [
  {
    slug: "ceo",
    name: "CEO",
    permissionTier: UserRole.CEO,
    isProtected: true,
    matchesEnum: [UserRole.CEO],
  },
  {
    slug: "administrator",
    name: "Administrator",
    permissionTier: UserRole.ADMINISTRATOR,
    isProtected: true,
    matchesEnum: [UserRole.ADMINISTRATOR],
  },
  {
    slug: "finance",
    name: "Finance",
    permissionTier: UserRole.FINANCE,
    isProtected: true,
    matchesEnum: [UserRole.FINANCE],
  },
  {
    slug: "logistik",
    name: "Logistik",
    permissionTier: UserRole.LOGISTICS,
    isProtected: true,
    matchesEnum: [UserRole.LOGISTICS],
  },
  {
    slug: "marketing",
    name: "Marketing",
    permissionTier: UserRole.NORMAL_USER,
    isProtected: false,
    matchesEnum: [UserRole.MARKETING, UserRole.NORMAL_USER],
  },
  {
    slug: "creative-director",
    name: "Creative Director",
    permissionTier: UserRole.NORMAL_USER,
    isProtected: false,
    matchesEnum: [UserRole.CREATIVE_DIRECTOR],
  },
  {
    slug: "business-analyst",
    name: "Business Analyst",
    permissionTier: UserRole.NORMAL_USER,
    isProtected: false,
    matchesEnum: [UserRole.BUSINESS_ANALYST],
  },
  {
    slug: "copywriter",
    name: "Copywriter",
    permissionTier: UserRole.NORMAL_USER,
    isProtected: false,
    matchesEnum: [UserRole.COPYWRITER],
  },
  {
    slug: "project-manager",
    name: "Project Manager",
    permissionTier: UserRole.PROJECT_MANAGER,
    isProtected: false,
    matchesEnum: [UserRole.PROJECT_MANAGER],
  },
];

/**
 * Tier enum studio lama yang dilebur ke `NORMAL_USER`. Kami pertahankan
 * value enum-nya supaya data historis tidak rusak, tapi tidak menawarkan
 * lagi sebagai pilihan tier baru.
 */
const LEGACY_STUDIO_TIERS: UserRole[] = [
  UserRole.MARKETING,
  UserRole.CREATIVE_DIRECTOR,
  UserRole.BUSINESS_ANALYST,
  UserRole.COPYWRITER,
];

let seedingPromise: Promise<void> | null = null;

/**
 * Idempotent — pastikan semua custom role bawaan ada di database.
 * Tidak menimpa role yang sudah pernah diganti namanya oleh user (cek by slug).
 * Setelah seed, melakukan backfill `customRoleId` untuk user yang belum punya.
 */
export async function ensureCustomRolesSeeded(): Promise<void> {
  if (seedingPromise) return seedingPromise;
  seedingPromise = (async () => {
    for (const seed of CUSTOM_ROLE_SEED) {
      try {
        await prisma.customRole.upsert({
          where: { slug: seed.slug },
          update: seed.isProtected
            ? { isProtected: true, permissionTier: seed.permissionTier }
            : {},
          create: {
            slug: seed.slug,
            name: seed.name,
            permissionTier: seed.permissionTier,
            isProtected: seed.isProtected,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          continue;
        }
        throw err;
      }
    }
    // Backfill harus duluan: pakai role enum lama untuk memetakan user ke
    // custom role yang tepat sebelum role enum-nya ikut dimigrasi.
    await backfillUserCustomRoleIds();
    await migrateLegacyStudioTiers();
  })().finally(() => {
    seedingPromise = null;
  });
  return seedingPromise;
}

/**
 * Geser semua data legacy (tier studio lama) ke `NORMAL_USER`.
 *
 * - `CustomRole.permissionTier` yang masih MARKETING/CREATIVE_DIRECTOR/
 *   BUSINESS_ANALYST/COPYWRITER → NORMAL_USER.
 * - `User.role` yang masih salah satu dari empat itu → NORMAL_USER.
 *
 * Idempotent: aman dijalankan berulang.
 */
async function migrateLegacyStudioTiers() {
  await prisma.customRole.updateMany({
    where: { permissionTier: { in: LEGACY_STUDIO_TIERS } },
    data: { permissionTier: UserRole.NORMAL_USER },
  });
  await prisma.user.updateMany({
    where: { role: { in: LEGACY_STUDIO_TIERS } },
    data: { role: UserRole.NORMAL_USER },
  });
}

async function backfillUserCustomRoleIds() {
  const seeded = await prisma.customRole.findMany({
    where: { slug: { in: CUSTOM_ROLE_SEED.map((s) => s.slug) } },
    select: { id: true, slug: true, permissionTier: true },
  });
  const slugToRole = new Map(seeded.map((r) => [r.slug, r]));
  const usersWithoutRole = await prisma.user.findMany({
    where: { customRoleId: null },
    select: { id: true, role: true },
  });
  for (const u of usersWithoutRole) {
    const seed = CUSTOM_ROLE_SEED.find((s) => s.matchesEnum.includes(u.role));
    if (!seed) continue;
    const target = slugToRole.get(seed.slug);
    if (!target) continue;
    try {
      await prisma.user.update({
        where: { id: u.id },
        data: { customRoleId: target.id },
      });
    } catch {
      /* abaikan */
    }
  }
}
