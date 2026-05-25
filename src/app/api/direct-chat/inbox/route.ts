import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canUseDirectChat } from "@/lib/direct-chat-access";
import { loadDirectChatInbox } from "@/lib/direct-chat-inbox";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseDirectChat(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const inbox = await loadDirectChatInbox(session.user.id);
  const totalUnread = inbox.reduce((acc, i) => acc + i.unreadCount, 0);

  return NextResponse.json(
    { inbox, totalUnread, serverTime: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
