import { UserRole } from "@/lib/user-role";
import {
  isLogistics,
  isMarketAnalyst,
  isStudioOrProjectManager,
} from "@/lib/roles";

/**
 * Halaman awal per tier peran. Bebas Prisma — dipakai `proxy.ts` (redirect)
 * dan action pindah mode (tujuan setelah berganti peran).
 */
export function defaultHomeForRole(role: UserRole | undefined): string {
  if (role === UserRole.CEO) return "/";
  if (role === UserRole.ADMINISTRATOR) return "/home";
  if (role === UserRole.FINANCE) return "/finance";
  if (isMarketAnalyst(role)) return "/dominatus-lab";
  // Logistik ikut ruang kerja studio, tapi beranda kerjanya tetap inventori.
  if (isLogistics(role)) return "/inventory";
  if (isStudioOrProjectManager(role)) return "/home";
  return "/inventory";
}
