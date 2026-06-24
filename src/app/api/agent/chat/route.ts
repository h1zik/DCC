import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canUseAgent } from "@/lib/agent/access";
import { runAgentChat } from "@/lib/agent/chat";
import { resolveAgentApiKey } from "@/lib/agent/provider";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  const user = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    role: session.user.role,
  };

  if (!canUseAgent(user)) {
    return NextResponse.json(
      { error: "Peran Anda tidak memiliki akses ke AI Agent." },
      { status: 403 },
    );
  }

  if (!resolveAgentApiKey()) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY belum diset. Dapatkan di https://aistudio.google.com/apikey",
      },
      { status: 503 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Format pesan tidak valid." }, { status: 400 });
  }

  try {
    const result = await runAgentChat(user, body.messages);
    return NextResponse.json({
      ok: true,
      reply: result.reply,
      toolCalls: result.toolCalls,
    });
  } catch (err) {
    console.error("[agent/chat]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Gagal memproses permintaan agent.",
      },
      { status: 500 },
    );
  }
}
