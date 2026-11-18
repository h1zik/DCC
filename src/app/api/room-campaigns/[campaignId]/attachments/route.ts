import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error-message";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  calendarAccessErrorStatus,
  ensureCampaignMember,
} from "@/lib/room-calendar/access";
import { CAMPAIGN_ATTACHMENT_MAX } from "@/lib/room-calendar/campaign-attachments";
import {
  removeCampaignFileBestEffort,
  saveCampaignFile,
} from "@/lib/room-calendar/campaign-files";
import { isAllowedRoomDocumentMime } from "@/lib/room-document-upload";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ campaignId: string }> };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Unggah satu file sebagai lampiran campaign (multipart, field `file`). */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await requireTasksRoomHubSession();
    const { campaignId } = await params;
    const { roomId, viewId } = await ensureCampaignMember(campaignId, session.user.id);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return fail("Pilih file terlebih dahulu.", 400);
    }
    if (file.size === 0) {
      return fail("File kosong, tidak ada yang bisa diunggah.", 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return fail(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`, 413);
    }
    const mime = (file.type || "application/octet-stream").slice(0, 160);
    if (!isAllowedRoomDocumentMime(mime, file.name)) {
      return fail("Tipe file tidak diizinkan.", 415);
    }

    const count = await prisma.roomCampaignAttachment.count({ where: { campaignId } });
    if (count >= CAMPAIGN_ATTACHMENT_MAX) {
      return fail(`Satu campaign maksimal ${CAMPAIGN_ATTACHMENT_MAX} lampiran.`, 400);
    }

    const saved = await saveCampaignFile({
      campaignId,
      fileName: file.name,
      size: file.size,
      body: file.stream(),
    });

    let id: string;
    try {
      const row = await prisma.roomCampaignAttachment.create({
        data: {
          campaignId,
          uploadedById: session.user.id,
          fileName: file.name.slice(0, 240) || "file",
          mimeType: mime,
          size: saved.bytesWritten || file.size,
          storagePath: saved.storagePath,
        },
        select: { id: true },
      });
      id = row.id;
    } catch (err) {
      // Baris gagal dibuat (mis. campaign dihapus di tengah unggahan): jangan tinggalkan file yatim.
      await removeCampaignFileBestEffort(saved.storagePath);
      throw err;
    }

    revalidatePath(`/room/${roomId}/view/${viewId}`);
    return NextResponse.json({ id });
  } catch (e) {
    const message = actionErrorMessage(e, "Unggah gagal.");
    return fail(message, calendarAccessErrorStatus(message, 400));
  }
}
