import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isMarketAnalystOrStudio } from "@/lib/roles";

/**
 * Content & Creator Studio — alat pembuatan konten untuk tim marketing.
 * Akses: tim studio, Project Manager (Brand Manager), dan Market Analyst.
 */
export async function requireContentStudioAccess() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  if (!isMarketAnalystOrStudio(session.user.role)) {
    throw new Error("Akses ditolak — hanya tim studio, PM, atau Market Analyst.");
  }
  return session;
}

export async function ensureContentStudioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isMarketAnalystOrStudio(session.user.role)) redirect("/home");
  return session;
}
