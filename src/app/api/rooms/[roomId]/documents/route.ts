import { actionErrorMessage } from "@/lib/action-error-message";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import { saveRoomDocumentToStorageAndDb } from "@/lib/room-document-upload";
import { normalizeRoomDocumentTags } from "@/lib/room-document-tags";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ roomId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await requireTasksRoomHubSession();
    const { roomId } = await params;

    await assertRoomMember(roomId, session.user.id);
    await prisma.room.findUniqueOrThrow({ where: { id: roomId } });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Pilih file terlebih dahulu." },
        { status: 400 },
      );
    }

    const titleRaw = formData.get("title");
    const title =
      typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : null;

    const folderIdRaw = formData.get("folderId");
    let folderId: string | null = null;
    if (typeof folderIdRaw === "string" && folderIdRaw.trim()) {
      const fid = folderIdRaw.trim();
      const f = await prisma.roomDocumentFolder.findFirst({
        where: { id: fid, roomId },
      });
      if (!f) {
        return NextResponse.json(
          { error: "Folder tidak ditemukan di ruangan ini." },
          { status: 400 },
        );
      }
      folderId = fid;
    }

    let tags: string[] = [];
    const tagsRaw = formData.get("tags");
    if (typeof tagsRaw === "string" && tagsRaw.trim()) {
      try {
        const parsed = JSON.parse(tagsRaw) as unknown;
        if (Array.isArray(parsed)) {
          tags = normalizeRoomDocumentTags(
            parsed.filter((x): x is string => typeof x === "string"),
          );
        }
      } catch {
        /* abaikan */
      }
    }

    const row = await saveRoomDocumentToStorageAndDb({
      roomId,
      uploadedById: session.user.id,
      folderId,
      title,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      body: file.stream(),
      tags: tags.length ? tags : undefined,
    });

    revalidateTasksAndRoomHub();

    return NextResponse.json({
      id: row.id,
      publicPath: row.publicPath,
    });
  } catch (e) {
    const msg = actionErrorMessage(e, "Unggah gagal.");
    const unauthorized =
      msg.includes("Belum masuk") || msg.includes("dapat melakukan");
    return NextResponse.json(
      { error: msg },
      { status: unauthorized ? 401 : 400 },
    );
  }
}
