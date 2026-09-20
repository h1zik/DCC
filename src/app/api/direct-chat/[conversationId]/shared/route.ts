import { NextResponse } from "next/server";
import { authorizeDirectChatRequest } from "@/lib/direct-chat-access";
import {
  loadDirectChatShared,
  parseDirectChatSharedKind,
} from "@/lib/direct-chat-shared";

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const guard = await authorizeDirectChatRequest(conversationId);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const kind = parseDirectChatSharedKind(url.searchParams.get("kind"));
  if (!kind) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const page = await loadDirectChatShared(
    conversationId,
    kind,
    url.searchParams.get("cursor"),
  );

  return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
}
