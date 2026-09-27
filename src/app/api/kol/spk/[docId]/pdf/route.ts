import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { KOL_APPROVE_CAPABILITY } from "@/lib/capabilities";
import { canAccessSpk } from "@/lib/kol/spk";
import { spkDocumentHtml, spkTextToHtml } from "@/lib/kol/spk-template";
import { hasLabCapability } from "@/lib/lab-access";
import { renderHtmlToPdfBuffer } from "@/lib/pdf/render-html-to-pdf";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ docId: string }> };

/** PDF SPK dari isi yang dibekukan. `?format=html` untuk pratinjau cepat. */
export async function GET(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Belum masuk.", { status: 401 });
  if (!(await hasLabCapability("lab.kol"))) {
    return new NextResponse("Tidak punya akses KOL Hub.", { status: 403 });
  }
  const { docId } = await params;
  const approver = await hasLabCapability(KOL_APPROVE_CAPABILITY);
  const { doc, allowed } = await canAccessSpk(docId, session.user.id, approver);
  if (!doc) return new NextResponse("SPK tidak ditemukan.", { status: 404 });
  if (!allowed) {
    return new NextResponse(
      "SPK berisi data pribadi KOL — hanya approver, pengaju jadwal, atau PIC yang bisa membukanya.",
      { status: 403 },
    );
  }

  const html = spkDocumentHtml(spkTextToHtml(doc.renderedBody), doc.docNumber);
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (new URL(req.url).searchParams.get("format") === "html") {
    return new NextResponse(html, {
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    });
  }
  const pdf = await renderHtmlToPdfBuffer(html);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.docNumber}.pdf"`,
    },
  });
}
