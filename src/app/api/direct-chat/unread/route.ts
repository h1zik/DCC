import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canUseDirectChat } from "@/lib/roles";
import { loadDirectChatTotalUnread } from "@/lib/direct-chat-inbox";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseDirectChat(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const unread = await loadDirectChatTotalUnread(session.user.id);

  return NextResponse.json(
    { unread, serverTime: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
