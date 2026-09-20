import { NextResponse } from "next/server";
import { authorizeDirectChatRequest } from "@/lib/direct-chat-access";
import { searchDirectChatMessages } from "@/lib/direct-chat-shared";

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const guard = await authorizeDirectChatRequest(conversationId);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const page = await searchDirectChatMessages(
    conversationId,
    (url.searchParams.get("q") ?? "").slice(0, 200),
    url.searchParams.get("cursor"),
  );

  return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
}
