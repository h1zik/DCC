/** Rute inventori & master data — hanya Logistik. */
export const LOGISTICS_ROUTE_PREFIXES = [
  "/products",
  "/vendors",
  "/inventory",
] as const;

/** Profil pengguna — semua peran yang sudah login. */
export function isProfileRoute(pathname: string): boolean {
  return pathname === "/profile" || pathname.startsWith("/profile/");
}

export function isLogisticsRoute(pathname: string): boolean {
  return LOGISTICS_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Pipeline & tugas — tim studio / PM. */
export function isStudioWorkspaceRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/projects") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/room")
  );
}

/** Rute yang boleh diakses CEO (brand & ruang kerja di administrator). */
export function isCeoAppRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/room") ||
    pathname.startsWith("/approvals") ||
    pathname.startsWith("/admin")
  );
}

/** Brand, ruang kerja, tugas/Kanban (dukungan), profil — administrator. */
export function isAdministratorAppRoute(pathname: string): boolean {
  return (
    isProfileRoute(pathname) ||
    pathname.startsWith("/rooms") ||
    pathname.startsWith("/brands") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/room")
  );
}
