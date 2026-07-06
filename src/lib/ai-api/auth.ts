import { timingSafeEqual } from "node:crypto";
import { UserRole } from "@prisma/client";

/** Role efektif untuk filter data AI — ditetapkan server-side (bukan client). */
export type AiApiRole =
  | "CEO"
  | "ADMINISTRATOR"
  | "LOGISTICS"
  | "FINANCE"
  | "STUDIO"
  | "ALL";

const ROLE_HEADER = "x-dcc-role";

const VALID_ROLES = new Set<AiApiRole>([
  "CEO",
  "ADMINISTRATOR",
  "LOGISTICS",
  "FINANCE",
  "STUDIO",
  "ALL",
]);

/**
 * Role efektif ditetapkan server-side lewat `AI_READ_API_ROLE`, TERIKAT pada
 * token — bukan dipilih client. Header `x-dcc-role` diabaikan untuk otorisasi
 * kecuali `AI_READ_API_ALLOW_ROLE_HEADER=true` di-set eksplisit (dev/simulasi),
 * sehingga tidak ada eskalasi hak diam-diam ke CEO/ALL.
 *
 * Mengembalikan `null` bila `AI_READ_API_ROLE` tidak diset/invalid — dulu
 * default diam-diam ke "CEO", yang membuat token bersama yang bocor langsung
 * punya akses baca finance penuh (fail-open). Guard menolak request bila null.
 */
export function resolveAiApiRole(req: Request): AiApiRole | null {
  const configured = process.env.AI_READ_API_ROLE?.trim().toUpperCase();
  const base: AiApiRole | null =
    configured && VALID_ROLES.has(configured as AiApiRole)
      ? (configured as AiApiRole)
      : null;

  if (process.env.AI_READ_API_ALLOW_ROLE_HEADER === "true") {
    const raw = req.headers.get(ROLE_HEADER)?.trim().toUpperCase();
    if (raw && VALID_ROLES.has(raw as AiApiRole)) {
      return raw as AiApiRole;
    }
  }
  return base;
}

/** Bandingkan dua string rahasia secara konstan-waktu (anti timing attack). */
function secretEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function isAiApiAuthorized(req: Request): boolean {
  const token = process.env.AI_READ_API_TOKEN?.trim();
  if (!token) return false;

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return bearer.length > 0 && secretEquals(bearer, token);
}

export function canViewTasks(role: AiApiRole): boolean {
  return (
    role === "ALL" ||
    role === "CEO" ||
    role === "ADMINISTRATOR" ||
    role === "STUDIO"
  );
}

export function canViewInventory(role: AiApiRole): boolean {
  return role === "ALL" || role === "CEO" || role === "LOGISTICS";
}

export function canViewApprovals(role: AiApiRole): boolean {
  return role === "ALL" || role === "CEO";
}

export function canViewFinancePending(role: AiApiRole): boolean {
  return role === "ALL" || role === "CEO" || role === "FINANCE";
}

export function canViewFinanceSummary(role: AiApiRole): boolean {
  return role === "ALL" || role === "CEO" || role === "FINANCE";
}

export function canViewSchedule(role: AiApiRole): boolean {
  return (
    role === "ALL" ||
    role === "CEO" ||
    role === "ADMINISTRATOR" ||
    role === "STUDIO" ||
    role === "FINANCE" ||
    role === "LOGISTICS"
  );
}

export function canViewAttendance(role: AiApiRole): boolean {
  return role === "ALL" || role === "CEO" || role === "ADMINISTRATOR";
}

export function canViewRoomsWiki(role: AiApiRole): boolean {
  return canViewTasks(role) || role === "ALL";
}

export function canViewExecutive(role: AiApiRole): boolean {
  return role === "ALL" || role === "CEO" || role === "ADMINISTRATOR";
}

export function canViewBrandPipeline(role: AiApiRole): boolean {
  return (
    role === "ALL" ||
    role === "CEO" ||
    role === "ADMINISTRATOR" ||
    role === "STUDIO"
  );
}

export function canViewOrgUsers(role: AiApiRole): boolean {
  return role === "ALL" || role === "CEO" || role === "ADMINISTRATOR";
}

export function canViewResearch(role: AiApiRole): boolean {
  return role === "ALL" || role === "CEO" || role === "ADMINISTRATOR";
}

/** Akses baca Research Hub — MCP (AiApiRole) + AI Agent in-app (UserRole). */
export function canViewResearchHub(role: UserRole | AiApiRole): boolean {
  if (role === UserRole.MARKET_ANALYST || role === UserRole.PROJECT_MANAGER) {
    return true;
  }
  if (role === UserRole.CEO || role === UserRole.ADMINISTRATOR) return true;
  return canViewResearch(role as AiApiRole);
}

/** Map header role ke label Prisma (untuk logging). */
export function aiRoleLabel(role: AiApiRole): string {
  if (role === "STUDIO") return UserRole.NORMAL_USER;
  return role;
}
