import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { KOL_APPROVE_CAPABILITY } from "@/lib/capabilities";
import { canAccessSpk } from "@/lib/kol/spk";
import { kolFileExists, resolveKolUploadPath } from "@/lib/kol/spk-storage";
import { hasLabCapability } from "@/lib/lab-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ docId: string }> };

/** Unduh SPK bertanda tangan dari storage privat. */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Belum masuk.", { status: 401 });
  if (!(await hasLabCapability("lab.kol"))) {
    return new NextResponse("Tidak punya akses KOL Hub.", { status: 403 });
  }
  const { docId } = await params;
  const approver = await hasLabCapability(KOL_APPROVE_CAPABILITY);
  const { doc, allowed } = await canAccessSpk(docId, session.user.id, approver);
  if (!doc?.signedFileKey) return new NextResponse("File belum diunggah.", { status: 404 });
  if (!allowed) return new NextResponse("Akses ditolak.", { status: 403 });
  if (!(await kolFileExists(doc.signedFileKey))) {
    return new NextResponse("File fisik hilang.", { status: 410 });
  }

  const fullPath = resolveKolUploadPath(doc.signedFileKey);
  const stream = Readable.toWeb(
    createReadStream(/* turbopackIgnore: true */ fullPath),
  ) as unknown as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": doc.signedMime || "application/octet-stream",
      ...(doc.signedSize ? { "Content-Length": String(doc.signedSize) } : {}),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.signedFileName ?? `${doc.docNumber}-ttd`)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
