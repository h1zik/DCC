import { UserRole } from "@prisma/client";

/** Role efektif untuk filter data AI — dikirim via header `x-dcc-role`. */
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

export function parseAiApiRole(req: Request): AiApiRole {
  const raw = req.headers.get(ROLE_HEADER)?.trim().toUpperCase();
  if (raw && VALID_ROLES.has(raw as AiApiRole)) {
    return raw as AiApiRole;
  }
  return "CEO";
}

export function isAiApiAuthorized(req: Request): boolean {
  const token = process.env.AI_READ_API_TOKEN?.trim();
  if (!token) return false;

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return bearer.length > 0 && bearer === token;
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

/** Map header role ke label Prisma (untuk logging). */
export function aiRoleLabel(role: AiApiRole): string {
  if (role === "STUDIO") return UserRole.NORMAL_USER;
  return role;
}
