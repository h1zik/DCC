import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePersonalOwnerId } from "@/lib/personal-space";
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
  params: Promise<{ noteId: string }>;
};

export async function GET(req: Request, { params }: Ctx) {
  try {
    const ownerId = await requirePersonalOwnerId();
    const { noteId } = await params;

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

    const note = await prisma.personalNote.findFirst({
      where: { id: noteId, ownerId },
      select: { title: true, content: true },
    });
    if (!note) {
      return new NextResponse("Catatan tidak ditemukan.", { status: 404 });
    }

    const basename = sanitizeWikiFilename(note.title, noteId.slice(0, 8));
    const filename = `${basename}.${WIKI_EXPORT_EXT[format]}`;

    if (format === "docx") {
      const buffer = await buildWikiDocxBuffer(note.title, note.content);
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
        body = buildWikiHtmlDocument(note.title, sanitizeRichHtml(note.content));
        break;
      case "md":
        body = `# ${note.title}\n\n${htmlToMarkdown(note.content)}`;
        break;
      case "txt":
        body = `${note.title}\n${"=".repeat(Math.min(note.title.length, 40))}\n\n${htmlToPlainText(note.content)}`;
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
    const status = message.includes("Belum masuk") ? 401 : 500;
    return new NextResponse(message, { status });
  }
}
