import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import {
  attachmentFileExists,
  resolveFinanceAttachmentPath,
} from "@/lib/finance-uploads";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  await requireFinance();
  const { id } = await params;

  const att = await prisma.financeJournalLineAttachment.findUnique({
    where: { id },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
      url: true,
    },
  });
  if (!att) {
    return new NextResponse("Lampiran tidak ditemukan.", { status: 404 });
  }

  const exists = await attachmentFileExists(att.url);
  if (!exists) {
    return new NextResponse("File fisik hilang.", { status: 410 });
  }

  const fullPath = resolveFinanceAttachmentPath(att.url);
  const nodeStream = createReadStream(fullPath);
  // Cast to web ReadableStream supaya kompatibel dengan Response.
  const stream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": att.mimeType || "application/octet-stream",
      "Content-Length": String(att.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
