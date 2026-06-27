import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessResearchHub } from "@/lib/roles";

/**
 * SEO Toolkit memakai akses yang sama dengan Research Hub: Market Analyst &
 * Project Manager (Brand Manager). Throw bila tidak berhak — dipakai di server
 * actions.
 */
export async function requireSeoAccess() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (!canAccessResearchHub(session.user.role)) {
    throw new Error(
      "Akses ditolak — hanya Market Analyst atau Project Manager.",
    );
  }
  return session;
}

/** Versi untuk halaman/layout: redirect alih-alih throw. */
export async function ensureSeoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccessResearchHub(session.user.role)) redirect("/home");
  return session;
}
