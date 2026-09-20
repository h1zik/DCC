import { NextResponse } from "next/server";
import {
  authorizeDirectChatRequest,
  getDirectChatPeerLastReadAt,
} from "@/lib/direct-chat-access";
import {
  loadDirectChatMessages,
  loadDirectChatMessagesOlder,
  loadDirectChatMessagesSince,
  DIRECT_CHAT_INITIAL_MESSAGE_LIMIT,
} from "@/lib/direct-chat-message-view";
import { loadDirectChatMessagesUntil } from "@/lib/direct-chat-shared";

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const guard = await authorizeDirectChatRequest(conversationId);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const beforeParam = url.searchParams.get("before");
  const untilParam = url.searchParams.get("until");
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;

  // Mode "jump": lompat ke pesan lama (hasil pencarian, berkas, kutipan balasan).
  // Memuat rentang target → pesan tertua milik klien agar riwayat tetap utuh.
  if (untilParam) {
    const page = await loadDirectChatMessagesUntil(
      conversationId,
      untilParam,
      beforeParam,
    );
    if (!page) {
      return NextResponse.json(
        { error: "Pesan terlalu jauh di riwayat atau sudah tidak ada." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      {
        messages: page.messages,
        hasMore: page.hasMore,
        mode: "jump",
        serverTime: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

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
    getDirectChatPeerLastReadAt(conversationId, guard.userId),
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
