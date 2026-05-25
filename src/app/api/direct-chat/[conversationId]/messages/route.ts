import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canUseDirectChat } from "@/lib/direct-chat-access";
import {
  assertDirectConversationMember,
  getDirectChatPeerLastReadAt,
} from "@/lib/direct-chat-access";
import {
  loadDirectChatMessages,
  loadDirectChatMessagesSince,
  DIRECT_CHAT_INITIAL_MESSAGE_LIMIT,
} from "@/lib/direct-chat-message-view";

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseDirectChat(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { conversationId } = await context.params;
  if (!conversationId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    await assertDirectConversationMember(conversationId, session.user.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;

  const [messages, peerLastReadAt] = await Promise.all([
    since && Number.isFinite(since.getTime())
      ? loadDirectChatMessagesSince(conversationId, since)
      : loadDirectChatMessages(conversationId),
    getDirectChatPeerLastReadAt(conversationId, session.user.id),
  ]);

  return NextResponse.json(
    {
      messages,
      peerLastReadAt: peerLastReadAt?.toISOString() ?? null,
      mode: since ? "delta" : "initial",
      initialLimit: DIRECT_CHAT_INITIAL_MESSAGE_LIMIT,
      serverTime: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
