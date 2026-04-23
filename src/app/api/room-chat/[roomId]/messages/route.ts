import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { loadRoomChatMessagesForRoom } from "@/lib/room-chat-message-view";
import { assertRoomMember } from "@/lib/room-access";
import { isAdministrator, isStudioOrProjectManager } from "@/lib/roles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (
    role !== UserRole.CEO &&
    !isAdministrator(role) &&
    !isStudioOrProjectManager(role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { roomId } = await context.params;
  if (!roomId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    await assertRoomMember(roomId, session.user.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await loadRoomChatMessagesForRoom(roomId);
  return NextResponse.json({ messages });
}
