import { UserRole } from "@prisma/client";

/** Peran yang mengelola ruangan kerja, pipeline, dan Kanban tugas. */
export const STUDIO_TEAM_ROLES: UserRole[] = [
  UserRole.MARKETING,
  UserRole.CREATIVE_DIRECTOR,
  UserRole.BUSINESS_ANALYST,
  UserRole.COPYWRITER,
];

/** PIC tugas — dipilih oleh Project Manager. */
export const PICAssignableRoles: UserRole[] = [...STUDIO_TEAM_ROLES];

/** Akses papan tugas, ruangan, pipeline (studio + PM). */
export function isStudioOrProjectManager(role: UserRole | undefined): boolean {
  if (!role) return false;
  return role === UserRole.PROJECT_MANAGER || STUDIO_TEAM_ROLES.includes(role);
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
  return STUDIO_TEAM_ROLES.includes(role);
}
