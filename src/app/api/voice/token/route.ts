import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertRoomMember } from "@/lib/room-access";
import { isAdministrator, isStudioOrProjectManager } from "@/lib/roles";
import { isVoiceConfigured, mintVoiceToken } from "@/lib/voice-server";

export async function GET(request: Request) {
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

  if (!isVoiceConfigured()) {
    return NextResponse.json(
      { error: "Voice belum dikonfigurasi di server." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const channelId = url.searchParams.get("channelId")?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const channel = await prisma.roomChannel.findUnique({
    where: { id: channelId },
    select: { id: true, roomId: true, type: true },
  });
  if (!channel || channel.type !== "VOICE") {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  try {
    await assertRoomMember(channel.roomId, session.user.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const name =
    session.user.name?.trim() || session.user.email || session.user.id;
  const { token, serverUrl } = await mintVoiceToken({
    roomId: channel.roomId,
    channelId: channel.id,
    userId: session.user.id,
    name,
    image: session.user.image ?? null,
  });

  return NextResponse.json(
    { token, serverUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
