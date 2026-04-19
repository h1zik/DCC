import { UserRole } from "@prisma/client";

/** Peran yang boleh ditetapkan CEO untuk pengguna baru / di halaman hak akses (bukan CEO). */
export const CEO_ASSIGNABLE_USER_ROLES = [
  UserRole.ADMINISTRATOR,
  UserRole.LOGISTICS,
  UserRole.MARKETING,
  UserRole.CREATIVE_DIRECTOR,
  UserRole.BUSINESS_ANALYST,
  UserRole.COPYWRITER,
  UserRole.PROJECT_MANAGER,
] as const satisfies readonly UserRole[];

export function ceoAssignableRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.ADMINISTRATOR:
      return "Administrator";
    case UserRole.LOGISTICS:
      return "Logistik";
    case UserRole.MARKETING:
      return "Marketing";
    case UserRole.CREATIVE_DIRECTOR:
      return "Creative director";
    case UserRole.BUSINESS_ANALYST:
      return "Business analyst";
    case UserRole.COPYWRITER:
      return "Copywriter";
    case UserRole.PROJECT_MANAGER:
      return "Project manager";
    case UserRole.CEO:
      return "CEO";
    default:
      return role;
  }
}
