/**
 * Mirror string-literal dari enum Prisma `UserRole` (prisma/schema.prisma).
 *
 * Dipakai di jalur yang TIDAK boleh menyeret `@prisma/client` ke bundle
 * (proxy.ts + lib/roles.ts). Nilai runtime enum Prisma memang string yang
 * sama, jadi dua-duanya kompatibel dua arah. Jika enum di schema berubah,
 * perbarui daftar ini juga.
 */
export const UserRole = {
  CEO: "CEO",
  ADMINISTRATOR: "ADMINISTRATOR",
  LOGISTICS: "LOGISTICS",
  NORMAL_USER: "NORMAL_USER",
  PROJECT_MANAGER: "PROJECT_MANAGER",
  FINANCE: "FINANCE",
  MARKETING: "MARKETING",
  CREATIVE_DIRECTOR: "CREATIVE_DIRECTOR",
  BUSINESS_ANALYST: "BUSINESS_ANALYST",
  COPYWRITER: "COPYWRITER",
  MARKET_ANALYST: "MARKET_ANALYST",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
