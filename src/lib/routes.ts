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

/** Jadwal & pengingat meeting (umum, tidak per ruangan). */
export function isScheduleRoute(pathname: string): boolean {
  return pathname === "/schedule" || pathname.startsWith("/schedule/");
}

export function isLogisticsRoute(pathname: string): boolean {
  return (
    isScheduleRoute(pathname) ||
    LOGISTICS_ROUTE_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  );
}

/** Pipeline & tugas — tim studio / PM. */
export function isStudioWorkspaceRoute(pathname: string): boolean {
  return (
    isScheduleRoute(pathname) ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/room")
  );
}

/** Rute yang boleh diakses CEO (mode pemantauan). */
export function isCeoAppRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    isScheduleRoute(pathname) ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/room") ||
    pathname.startsWith("/approvals")
  );
}

/** Brand, ruang kerja, pengguna/hak akses, tugas/Kanban (dukungan), profil — administrator. */
export function isAdministratorAppRoute(pathname: string): boolean {
  return (
    isProfileRoute(pathname) ||
    isScheduleRoute(pathname) ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/rooms") ||
    pathname.startsWith("/brands") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/room")
  );
}
