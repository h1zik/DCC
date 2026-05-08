import { UserRole } from "@prisma/client";

/**
 * Tier permission untuk member umum studio.
 *
 * Sebelumnya kami punya 4 tier studio terpisah (MARKETING, CREATIVE_DIRECTOR,
 * BUSINESS_ANALYST, COPYWRITER) — semuanya bermuara di akses yang sama, jadi
 * sekarang dikonsolidasi ke satu tier `NORMAL_USER`. Nama spesifik (Marketing,
 * Copywriter, dst.) tetap hidup sebagai *custom role* di tabel `CustomRole`.
 *
 * Konstanta lama `STUDIO_TEAM_ROLES` masih diekspor agar pemanggil yang
 * mengiterasinya tidak rusak — tapi sekarang isinya cuma `NORMAL_USER`.
 */
export const STUDIO_TEAM_ROLES: UserRole[] = [UserRole.NORMAL_USER];

/**
 * Daftar enum legacy yang dulu mewakili tim studio. Disimpan terpisah agar
 * pengecekan akses tetap mengakui user lama yang belum terbackfill.
 */
const LEGACY_STUDIO_ROLES: UserRole[] = [
  UserRole.MARKETING,
  UserRole.CREATIVE_DIRECTOR,
  UserRole.BUSINESS_ANALYST,
  UserRole.COPYWRITER,
];

/** PIC tugas — dipilih oleh Project Manager. */
export const PICAssignableRoles: UserRole[] = [
  UserRole.NORMAL_USER,
  UserRole.PROJECT_MANAGER,
];

/** Akses papan tugas, ruangan, pipeline (studio + PM). */
export function isStudioOrProjectManager(role: UserRole | undefined): boolean {
  if (!role) return false;
  if (role === UserRole.PROJECT_MANAGER) return true;
  if (role === UserRole.NORMAL_USER) return true;
  return LEGACY_STUDIO_ROLES.includes(role);
}

/** CEO atau tim studio/PM — kelola proyek di pipeline. */
export function canManagePipelineProjects(role: UserRole | undefined): boolean {
  if (!role) return false;
  return role === UserRole.CEO || isStudioOrProjectManager(role);
}

export function isProjectManager(role: UserRole | undefined): boolean {
  return role === UserRole.PROJECT_MANAGER;
}

export function isAdministrator(role: UserRole | undefined): boolean {
  return role === UserRole.ADMINISTRATOR;
}

export function isStudioTeamRole(role: UserRole | undefined): boolean {
  if (!role) return false;
  if (role === UserRole.NORMAL_USER) return true;
  return LEGACY_STUDIO_ROLES.includes(role);
}

export function isFinanceRole(role: UserRole | undefined): boolean {
  return role === UserRole.FINANCE;
}
