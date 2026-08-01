import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canUseDirectChat } from "@/lib/direct-chat-access";
import {
  assertDirectConversationMember,
  getDirectChatPeerLastReadAt,
} from "@/lib/direct-chat-access";
import {
  loadDirectChatMessages,
  loadDirectChatMessagesOlder,
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
  const beforeParam = url.searchParams.get("before");
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;

  // Mode "older": paginasi riwayat ke belakang. Tidak perlu status baca lawan
  // bicara — ini bukan polling, hanya penelusuran riwayat.
  if (beforeParam) {
    const page = await loadDirectChatMessagesOlder(conversationId, beforeParam);
    return NextResponse.json(
      {
        messages: page.messages,
        hasMore: page.hasMore,
        mode: "older",
        serverTime: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const isDelta = Boolean(since && Number.isFinite(since.getTime()));
  const [result, peerLastReadAt] = await Promise.all([
    isDelta
      ? loadDirectChatMessagesSince(conversationId, since!)
      : loadDirectChatMessages(conversationId),
    getDirectChatPeerLastReadAt(conversationId, session.user.id),
  ]);

  const messages = Array.isArray(result) ? result : result.messages;
  const hasMore = Array.isArray(result) ? false : result.hasMore;

  return NextResponse.json(
    {
      messages,
      hasMore,
      peerLastReadAt: peerLastReadAt?.toISOString() ?? null,
      mode: isDelta ? "delta" : "initial",
      initialLimit: DIRECT_CHAT_INITIAL_MESSAGE_LIMIT,
      serverTime: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
