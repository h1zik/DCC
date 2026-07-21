import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember, isRoomHubManagerRole } from "@/lib/room-access";
import { canEditRoomDocument } from "@/lib/room-document-permissions";
import { saveRoomDocumentVersionToStorageAndDb } from "@/lib/room-document-upload";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { actionErrorMessage } from "@/lib/action-error-message";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ roomId: string; documentId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const session = await requireTasksRoomHubSession();
    const { roomId, documentId } = await params;
    const member = await assertRoomMember(roomId, session.user.id);
    const document = await prisma.roomDocument.findFirstOrThrow({
      where: {
        id: documentId,
        roomId,
        trashedAt: null,
        OR: [{ folderId: null }, { folder: { trashedAt: null } }],
      },
      select: { folderId: true, uploadedById: true },
    });
    const allowed = await canEditRoomDocument(prisma, {
      roomId,
      documentId,
      folderId: document.folderId,
      uploadedById: document.uploadedById,
      userId: session.user.id,
      isManager: isRoomHubManagerRole(member.role),
    });
    if (!allowed) throw new Error("Anda tidak dapat menambah versi file ini.");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Pilih file versi baru.");
    const noteRaw = formData.get("note");
    const result = await saveRoomDocumentVersionToStorageAndDb({
      documentId,
      roomId,
      uploadedById: session.user.id,
      note: typeof noteRaw === "string" ? noteRaw : null,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      body: file.stream(),
    });
    revalidateTasksAndRoomHub();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: actionErrorMessage(error, "Gagal menambah versi.") },
      { status: 400 },
    );
  }
}
