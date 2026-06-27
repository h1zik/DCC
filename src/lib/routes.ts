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

/**
 * Modul absensi — boleh diakses semua peran yang sudah login (absensi
 * mandiri). Sub-rute admin (`/attendance/rekap`) tetap di-gate per halaman.
 */
export function isAttendanceRoute(pathname: string): boolean {
  return pathname === "/attendance" || pathname.startsWith("/attendance/");
}

export function isLogisticsRoute(pathname: string): boolean {
  return (
    isScheduleRoute(pathname) ||
    isAttendanceRoute(pathname) ||
    LOGISTICS_ROUTE_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  );
}

/** Modul keuangan — hanya peran Finance (plus profil & absensi). */
export function isFinanceAppRoute(pathname: string): boolean {
  return (
    isProfileRoute(pathname) ||
    isAttendanceRoute(pathname) ||
    pathname === "/finance" ||
    pathname.startsWith("/finance/")
  );
}

/** Modul Research Hub — Market Analyst & Project Manager. */
export function isResearchHubRoute(pathname: string): boolean {
  return (
    pathname === "/research-hub" || pathname.startsWith("/research-hub/")
  );
}

/** Modul SEO Toolkit — Market Analyst & Project Manager. */
export function isSeoRoute(pathname: string): boolean {
  return pathname === "/seo" || pathname.startsWith("/seo/");
}

/** Modul Brand & Creative Hub — Brand Manager (Project Manager). */
export function isBrandHubRoute(pathname: string): boolean {
  return pathname === "/brand-hub" || pathname.startsWith("/brand-hub/");
}

/** Research Hub, SEO Toolkit + studio workspace — Market Analyst. */
export function isMarketAnalystAppRoute(pathname: string): boolean {
  return (
    isResearchHubRoute(pathname) ||
    isSeoRoute(pathname) ||
    isStudioWorkspaceRoute(pathname)
  );
}

/** Pesan pribadi 1:1. */
export function isDirectChatRoute(pathname: string): boolean {
  return pathname === "/messages" || pathname.startsWith("/messages/");
}

/** AI Agent in-app — CEO, administrator, studio / PM. */
export function isAgentRoute(pathname: string): boolean {
  return pathname === "/agent" || pathname.startsWith("/agent/");
}

/** Home — administrator & tim studio/PM. */
export function isHomeRoute(pathname: string): boolean {
  return pathname === "/home" || pathname.startsWith("/home/");
}

/** @deprecated Gunakan {@link isHomeRoute}. Redirect legacy `/dashboard` tetap ada. */
export function isWorkspaceDashboardRoute(pathname: string): boolean {
  return (
    isHomeRoute(pathname) ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/")
  );
}

/** Pipeline, tugas, Brand Hub, Research Hub, SEO Toolkit — tim studio / PM. */
export function isStudioWorkspaceRoute(pathname: string): boolean {
  return (
    isWorkspaceDashboardRoute(pathname) ||
    isBrandHubRoute(pathname) ||
    isResearchHubRoute(pathname) ||
    isSeoRoute(pathname) ||
    isScheduleRoute(pathname) ||
    isDirectChatRoute(pathname) ||
    isAttendanceRoute(pathname) ||
    isAgentRoute(pathname) ||
    pathname.startsWith("/for-me") ||
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
    isDirectChatRoute(pathname) ||
    isAttendanceRoute(pathname) ||
    isAgentRoute(pathname) ||
    pathname.startsWith("/for-me") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/room") ||
    pathname.startsWith("/approvals")
  );
}

/** Brand, ruang kerja, pengguna/hak akses, tugas/Kanban (dukungan), profil — administrator. */
export function isAdministratorAppRoute(pathname: string): boolean {
  return (
    isWorkspaceDashboardRoute(pathname) ||
    isProfileRoute(pathname) ||
    isScheduleRoute(pathname) ||
    isDirectChatRoute(pathname) ||
    isAttendanceRoute(pathname) ||
    isAgentRoute(pathname) ||
    pathname.startsWith("/for-me") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/rooms") ||
    pathname.startsWith("/brands") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/room")
  );
}
