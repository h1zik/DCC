import "server-only";

import { NextResponse } from "next/server";
import { UserRole, type RoomMember } from "@prisma/client";
import { auth } from "@/lib/auth";
import { assertRoomMember } from "@/lib/room-access";
import { isAdministrator, isStudioOrProjectManager } from "@/lib/roles";

/**
 * Gerbang akses route voice per ruangan — aturan yang sama dengan
 * /api/voice/token: sesi valid, role yang boleh voice, dan anggota ruangan.
 */
export async function authorizeVoiceRoomRequest(
  roomId: string,
): Promise<
  | { ok: true; userId: string; member: RoomMember }
  | { ok: false; response: NextResponse }
> {
  const deny = (error: string, status: number) => ({
    ok: false as const,
    response: NextResponse.json({ error }, { status }),
  });

  const session = await auth();
  if (!session?.user?.id) return deny("Unauthorized", 401);

  const role = session.user.role;
  if (
    role !== UserRole.CEO &&
    !isAdministrator(role) &&
    !isStudioOrProjectManager(role)
  ) {
    return deny("Forbidden", 403);
  }
  if (!roomId) return deny("Bad request", 400);

  try {
    const member = await assertRoomMember(roomId, session.user.id);
    return { ok: true, userId: session.user.id, member };
  } catch {
    return deny("Forbidden", 403);
  }
}
