import "server-only";

import { auth } from "@/lib/auth";

/**
 * SATU-SATUNYA guard Space Pribadi. Kepemilikan murni — TANPA cek peran,
 * TANPA bypass CEO/ADMINISTRATOR (jangan pernah pakai `assertRoomMember`
 * atau helper peran di fitur ini). Semua query/mutasi tabel Personal*
 * WAJIB difilter `ownerId` yang dikembalikan fungsi ini.
 */
export async function requirePersonalOwnerId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  return session.user.id;
}
