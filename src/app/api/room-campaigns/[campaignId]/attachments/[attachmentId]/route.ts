import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  calendarAccessErrorStatus,
  ensureCampaignMember,
} from "@/lib/room-calendar/access";
import { isInlinePreviewable } from "@/lib/room-calendar/campaign-attachments";
import { resolveCampaignFilePath } from "@/lib/room-calendar/campaign-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ campaignId: string; attachmentId: string }> };

function disposition(kind: "inline" | "attachment", filename: string): string {
  return `${kind}; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Unduh lampiran campaign. `?inline=1` membuka file di tab browser, tetapi
 * hanya untuk PDF dan gambar raster; tipe lain selalu diunduh.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await requireTasksRoomHubSession();
    const { campaignId, attachmentId } = await params;
    await ensureCampaignMember(campaignId, session.user.id);

    const attachment = await prisma.roomCampaignAttachment.findFirst({
      where: { id: attachmentId, campaignId },
      select: { fileName: true, mimeType: true, storagePath: true },
    });
    if (!attachment?.storagePath) {
      return new NextResponse("Lampiran tidak ditemukan.", { status: 404 });
    }

    const abs = resolveCampaignFilePath(attachment.storagePath);
    const st = await stat(abs).catch(() => null);
    if (!st?.isFile()) {
      return new NextResponse("File fisik tidak ditemukan.", { status: 410 });
    }

    const wantsInline = new URL(req.url).searchParams.get("inline") === "1";
    const inline = wantsInline && isInlinePreviewable(attachment.mimeType);
    // MIME berasal dari unggahan; yang bentuknya aneh tidak diteruskan ke header.
    const mime = attachment.mimeType.toLowerCase();
    // Tipe yang bisa menjalankan skrip (HTML, SVG, XML) juga tidak dikirim dengan MIME aslinya.
    const safe =
      /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime) && !/html|svg|xml|javascript/.test(mime);
    const contentType = inline || safe ? mime : "application/octet-stream";

    // Stream dari disk — jangan buffer utuh ke RAM (lampiran bisa ratusan MB).
    const stream = Readable.toWeb(createReadStream(abs)) as unknown as ReadableStream;
    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(st.size),
        "Content-Disposition": disposition(inline ? "inline" : "attachment", attachment.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal mengunduh.";
    return new NextResponse(message, {
      status: calendarAccessErrorStatus(message, 500),
    });
  }
}
