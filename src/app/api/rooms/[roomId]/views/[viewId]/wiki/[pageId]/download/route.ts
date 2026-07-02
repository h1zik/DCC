import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import {
  attachmentDisposition,
  buildWikiHtmlDocument,
  htmlToMarkdown,
  htmlToPlainText,
  sanitizeWikiFilename,
  WIKI_EXPORT_EXT,
  WIKI_EXPORT_MIME,
} from "@/lib/wiki-export";
import { buildWikiDocxBuffer } from "@/lib/wiki-docx-export";
import { sanitizeRichHtml } from "@/lib/security/sanitize-html";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const formatSchema = z.enum(["html", "md", "txt", "docx"]);

type Ctx = {
  params: Promise<{ roomId: string; viewId: string; pageId: string }>;
};

export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await requireTasksRoomHubSession();
    const { roomId, viewId, pageId } = await params;
    await assertRoomMember(roomId, session.user.id);

    const url = new URL(req.url);
    const formatRaw = url.searchParams.get("format") ?? "html";
    const parsed = formatSchema.safeParse(formatRaw);
    if (!parsed.success) {
      return new NextResponse(
        "Format tidak didukung. Gunakan html, md, txt, atau docx. PDF diunduh dari browser.",
        { status: 400 },
      );
    }
    const format = parsed.data;

    const view = await prisma.roomView.findFirst({
      where: { id: viewId, roomId, type: "WIKI" },
      select: { id: true },
    });
    if (!view) {
      return new NextResponse("Wiki tidak ditemukan.", { status: 404 });
    }

    const page = await prisma.roomWikiPage.findFirst({
      where: { id: pageId, viewId },
      select: { title: true, content: true },
    });
    if (!page) {
      return new NextResponse("Halaman tidak ditemukan.", { status: 404 });
    }

    const basename = sanitizeWikiFilename(page.title, pageId.slice(0, 8));
    const filename = `${basename}.${WIKI_EXPORT_EXT[format]}`;

    if (format === "docx") {
      const buffer = await buildWikiDocxBuffer(page.title, page.content);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": WIKI_EXPORT_MIME.docx,
          "Content-Disposition": attachmentDisposition(filename),
          "Content-Length": String(buffer.byteLength),
          "Cache-Control": "private, no-store",
        },
      });
    }

    let body: string;
    switch (format) {
      case "html":
        body = buildWikiHtmlDocument(page.title, sanitizeRichHtml(page.content));
        break;
      case "md":
        body = `# ${page.title}\n\n${htmlToMarkdown(page.content)}`;
        break;
      case "txt":
        body = `${page.title}\n${"=".repeat(Math.min(page.title.length, 40))}\n\n${htmlToPlainText(page.content)}`;
        break;
      default:
        body = "";
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": WIKI_EXPORT_MIME[format],
        "Content-Disposition": attachmentDisposition(filename),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal mengunduh.";
    const status = message.includes("Unauthorized") || message.includes("autentikasi")
      ? 401
      : message.includes("anggota")
        ? 403
        : 500;
    return new NextResponse(message, { status });
  }
}
