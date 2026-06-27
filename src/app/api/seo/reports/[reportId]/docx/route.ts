import HTMLtoDOCX from "html-to-docx";
import { auth } from "@/lib/auth";
import { canAccessResearchHub } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { buildReportPdfHtml } from "@/lib/research/reports/report-pdf-html";
import { parseReportSections } from "@/lib/research/reports/types";

type Ctx = { params: Promise<{ reportId: string }> };

/** Ekspor laporan SEO sebagai DOCX (Word/LibreOffice/Google Docs). */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!canAccessResearchHub(session.user.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { reportId } = await params;
  const report = await prisma.seoReport.findUnique({ where: { id: reportId } });
  if (!report) return new Response("Not found", { status: 404 });

  const html = buildReportPdfHtml({
    title: report.title,
    aiSummary: report.aiSummary,
    sections: parseReportSections(report.sections),
    metrics: (report.metrics as Record<string, number> | null) ?? undefined,
    periodStart: report.periodStart?.toLocaleDateString("id-ID") ?? null,
    periodEnd: report.periodEnd?.toLocaleDateString("id-ID") ?? null,
  });

  const result = await HTMLtoDOCX(html, null, {
    title: report.title,
    font: "Arial",
    fontSize: 22,
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  });

  const buffer =
    result instanceof Buffer
      ? result
      : result instanceof ArrayBuffer
        ? Buffer.from(result)
        : ArrayBuffer.isView(result)
          ? Buffer.from(result.buffer, result.byteOffset, result.byteLength)
          : Buffer.from(result as unknown as ArrayBuffer);

  const safeName =
    report.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) ||
    "laporan-seo";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeName}.docx"`,
    },
  });
}
