import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import {
  loadRoomChatMessagesForRoom,
  loadRoomChatMessagesSince,
  ROOM_CHAT_INITIAL_MESSAGE_LIMIT,
} from "@/lib/room-chat-message-view";
import { assertRoomMember } from "@/lib/room-access";
import { isAdministrator, isStudioOrProjectManager } from "@/lib/roles";
import { listRoomTyping, markRoomTyping } from "@/lib/room-chat-typing-state";

export async function GET(
  request: Request,
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

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;

  let messages;
  let mode: "delta" | "initial";
  if (since && Number.isFinite(since.getTime())) {
    messages = await loadRoomChatMessagesSince(roomId, since);
    mode = "delta";
  } else {
    messages = await loadRoomChatMessagesForRoom(roomId);
    mode = "initial";
  }

  const typingUsers = listRoomTyping(roomId, session.user.id);
  return NextResponse.json(
    {
      messages,
      typingUsers,
      mode,
      initialLimit: ROOM_CHAT_INITIAL_MESSAGE_LIMIT,
      serverTime: new Date().toISOString(),
    },
    {
      headers: {
        // Polling chat tidak boleh di-cache oleh browser/CDN.
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(
  request: Request,
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

  const parsed = (await request.json().catch(() => null)) as
    | { typing?: unknown }
    | null;
  if (parsed?.typing !== true) {
    return NextResponse.json({ ok: true });
  }

  const rawLabel = typeof session.user.name === "string" ? session.user.name : "";
  const label = rawLabel.trim() || session.user.email || "Pengguna";
  markRoomTyping(roomId, session.user.id, label);
  return NextResponse.json({ ok: true });
}
