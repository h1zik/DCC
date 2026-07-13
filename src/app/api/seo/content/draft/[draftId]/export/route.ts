import HTMLtoDOCX from "html-to-docx";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import {
  buildCleanHtml,
  buildDocxHtml,
  buildMarkdown,
  type ExportableDraft,
} from "@/lib/seo/content/export";
import { slugify } from "@/lib/seo/content/slug";

type Ctx = { params: Promise<{ draftId: string }> };

/** Ekspor draft artikel: ?format=html|md|docx (default html). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireSeoAccess();
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const { draftId } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "html";

  const draft = await prisma.seoContentDraft.findUnique({
    where: { id: draftId },
  });
  if (!draft) return new Response("Not found", { status: 404 });

  const exportable: ExportableDraft = {
    title: draft.title,
    targetKeyword: draft.targetKeyword,
    contentHtml: draft.contentHtml,
    metaTitle: draft.metaTitle,
    metaDescription: draft.metaDescription,
    slug: draft.slug,
  };

  const fileBase = draft.slug || slugify(draft.title) || "artikel-seo";

  if (format === "md") {
    return new Response(buildMarkdown(exportable), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}.md"`,
      },
    });
  }

  if (format === "docx") {
    const result = await HTMLtoDOCX(buildDocxHtml(exportable), null, {
      title: draft.title,
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

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileBase}.docx"`,
      },
    });
  }

  return new Response(buildCleanHtml(exportable), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileBase}.html"`,
    },
  });
}
