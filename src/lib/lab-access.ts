import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  capabilityLabel,
  resolveCapabilities,
  toLabAccess,
  type Capability,
  type LabAccess,
  LAB_SHELL_CAPABILITY,
  NO_LAB_ACCESS,
} from "@/lib/capabilities";

/**
 * Resolver akses Dominatus Lab.
 *
 * Keputusan otorisasi sengaja dibuat di sini — di server, dengan Prisma —
 * bukan di `proxy.ts`. Proxy hanya membaca JWT (maxAge 7 hari) dan admin tidak
 * punya cara memaksa refresh token milik orang lain, jadi menaruh kapabilitas
 * di token berarti pencabutan akses bisa tertunda seminggu. Dokumentasi Next
 * pun menyebut proxy bukan tempat otorisasi, hanya "optimistic check".
 * Konsekuensinya: grant/revoke berlaku di navigasi berikutnya.
 *
 * Urutan resolusi:
 *   1. Basis  = `CustomRole.capabilities` bila user punya peran kustom,
 *               selain itu matriks tier historis (`baselineCapabilitiesForRole`).
 *   2. + ALLOW dari `UserCapability` yang belum kedaluwarsa.
 *   3. − DENY  dari `UserCapability`.
 *
 * DENY otomatis menang tanpa perlu diurutkan: `@@unique([userId, capability])`
 * memastikan satu kapabilitas hanya punya satu baris per user.
 */
const loadCapabilityInputs = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      customRole: { select: { capabilities: true } },
      capabilities: {
        select: { capability: true, effect: true, expiresAt: true },
      },
    },
  });
});

/** Kapabilitas efektif satu user. Ter-dedupe per request lewat `cache()`. */
export const getCapabilitiesForUser = cache(
  async (userId: string): Promise<Set<string>> => {
    const row = await loadCapabilityInputs(userId);
    if (!row) return new Set();
    return resolveCapabilities(row);
  },
);

/** Akses Lab user yang sedang login. */
export const getLabAccess = cache(async (): Promise<LabAccess> => {
  const session = await auth();
  if (!session?.user?.id) return NO_LAB_ACCESS;
  return toLabAccess(await getCapabilitiesForUser(session.user.id));
});

/** Akses Lab user mana pun — untuk pratinjau "akses efektif" di UI admin. */
export async function getLabAccessForUser(userId: string): Promise<LabAccess> {
  return toLabAccess(await getCapabilitiesForUser(userId));
}

/**
 * Versi batch untuk daftar pengguna — satu query, tanpa N+1.
 * Mengembalikan peta `userId → himpunan kapabilitas efektif`.
 */
export async function getCapabilitiesForUsers(
  userIds: string[],
): Promise<Map<string, Set<string>>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      role: true,
      customRole: { select: { capabilities: true } },
      capabilities: {
        select: { capability: true, effect: true, expiresAt: true },
      },
    },
  });
  const now = new Date();
  return new Map(rows.map((row) => [row.id, resolveCapabilities(row, now)]));
}

async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  return session;
}

/**
 * Apakah himpunan kapabilitas ini membuka `capability`?
 *
 * Kunci shell diperlakukan khusus: memegang satu modul saja sudah cukup untuk
 * masuk Lab, jadi jangan minta `lab` tersimpan eksplisit. Sebaliknya, modul
 * mana pun tetap butuh shell terbuka supaya tidak ada akses "menggantung".
 */
function grants(caps: Set<string>, capability: Capability): boolean {
  const { shell } = toLabAccess(caps);
  if (capability === LAB_SHELL_CAPABILITY) return shell;
  return shell && caps.has(capability);
}

/**
 * Guard server action & route handler — melempar bila kapabilitas tidak ada.
 * Pesannya menyebut nama fitur, bukan daftar peran, karena akses sekarang
 * diberikan per-fitur.
 */
export async function requireLabCapability(
  capability: Capability,
): Promise<Session> {
  const session = await requireSession();
  const caps = await getCapabilitiesForUser(session.user.id);
  if (!grants(caps, capability)) {
    throw new Error(
      `Akses ditolak — Anda belum diberi akses "${capabilityLabel(capability)}". Hubungi Administrator.`,
    );
  }
  return session;
}

/** Sama seperti di atas, tapi mengembalikan boolean (untuk route handler). */
export async function hasLabCapability(
  capability: Capability,
): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  return grants(await getCapabilitiesForUser(session.user.id), capability);
}

/**
 * Guard halaman/layout — redirect alih-alih melempar.
 *
 * Tanpa `capability`, cukup memastikan user boleh masuk shell Lab. Bila modul
 * tertentu terkunci tapi Lab-nya terbuka, user dikembalikan ke launcher —
 * bukan dilempar keluar Lab sama sekali.
 */
export async function ensureLabPage(
  capability?: Capability,
): Promise<{ session: Session; access: LabAccess }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const caps = await getCapabilitiesForUser(session.user.id);
  const access = toLabAccess(caps);
  if (!access.shell) redirect("/home");
  if (capability && !grants(caps, capability)) redirect("/dominatus-lab");

  return { session, access };
}
