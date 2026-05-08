import { UserRole } from "@prisma/client";

/**
 * Slug stabil untuk 4 role inti (protected). Dipakai sebagai pengaman agar
 * UI tidak menawarkan opsi delete untuk role inti.
 */
export const PROTECTED_ROLE_SLUGS = [
  "ceo",
  "administrator",
  "finance",
  "logistik",
] as const;
export type ProtectedRoleSlug = (typeof PROTECTED_ROLE_SLUGS)[number];

export function isProtectedRoleSlug(slug: string): slug is ProtectedRoleSlug {
  return (PROTECTED_ROLE_SLUGS as readonly string[]).includes(slug);
}

export function enumRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.CEO:
      return "CEO";
    case UserRole.ADMINISTRATOR:
      return "Administrator";
    case UserRole.FINANCE:
      return "Finance";
    case UserRole.LOGISTICS:
      return "Logistik";
    case UserRole.NORMAL_USER:
      return "Normal User";
    case UserRole.PROJECT_MANAGER:
      return "Project Manager";
    // Tier legacy — masih ada di enum agar data lama tidak rusak,
    // tapi tidak ditawarkan lagi di UI. Label fallback ke "Normal User".
    case UserRole.MARKETING:
    case UserRole.CREATIVE_DIRECTOR:
    case UserRole.BUSINESS_ANALYST:
    case UserRole.COPYWRITER:
      return "Normal User";
    default:
      return role;
  }
}

export function effectiveRoleLabel(input: {
  role: UserRole;
  customRole?: { name: string } | null;
}): string {
  if (input.customRole?.name?.trim()) return input.customRole.name.trim();
  return enumRoleLabel(input.role);
}

/** Label tier permission untuk dropdown/UI (mis. saat membuat custom role). */
export function permissionTierLabel(tier: UserRole): string {
  switch (tier) {
    case UserRole.CEO:
      return "CEO (akses penuh)";
    case UserRole.ADMINISTRATOR:
      return "Administrator (kelola pengguna & sistem)";
    case UserRole.FINANCE:
      return "Finance (akses modul keuangan)";
    case UserRole.LOGISTICS:
      return "Logistik (akses inventori & produk)";
    case UserRole.PROJECT_MANAGER:
      return "Project Manager (kelola pipeline & ruangan)";
    case UserRole.NORMAL_USER:
      return "Normal User (akses tugas, ruangan & pipeline)";
    // Legacy tiers — tetap render label sederhana kalau ketemu data lama.
    case UserRole.MARKETING:
    case UserRole.CREATIVE_DIRECTOR:
    case UserRole.BUSINESS_ANALYST:
    case UserRole.COPYWRITER:
      return "Normal User (akses tugas, ruangan & pipeline)";
    default:
      return enumRoleLabel(tier);
  }
}

/**
 * Tier permission yang boleh dipilih saat membuat custom role.
 * CEO sengaja tidak diekspos ke UI custom role.
 *
 * Empat tier studio lama (Marketing, Creative Director, Business Analyst,
 * Copywriter) sudah dilebur jadi `NORMAL_USER` karena sebelumnya semua
 * bermuara di akses studio yang sama.
 */
export const ASSIGNABLE_PERMISSION_TIERS: UserRole[] = [
  UserRole.ADMINISTRATOR,
  UserRole.FINANCE,
  UserRole.LOGISTICS,
  UserRole.PROJECT_MANAGER,
  UserRole.NORMAL_USER,
];

/** Buat slug dari nama. Lowercase, alfanumerik + dash, dipotong 80 karakter. */
export function slugifyRoleName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]+/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || `role-${Date.now().toString(36)}`;
}
