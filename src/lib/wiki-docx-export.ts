import HTMLtoDOCX from "html-to-docx";
import { buildWikiHtmlDocument, stripThemeClassesFromHtml } from "@/lib/wiki-export";

/** Buffer DOCX — kompatibel Word, LibreOffice, Google Docs. */
export async function buildWikiDocxBuffer(
  title: string,
  bodyHtml: string,
): Promise<Buffer> {
  const safeTitle = title.trim() || "Tanpa judul";
  const html = buildWikiHtmlDocument(
    safeTitle,
    stripThemeClassesFromHtml(bodyHtml),
  );

  const result = await HTMLtoDOCX(
    html,
    null,
    {
      title: safeTitle,
      font: "Arial",
      fontSize: 22,
      margins: {
        top: 1440,
        right: 1440,
        bottom: 1440,
        left: 1440,
      },
    },
    null,
  );

  if (result instanceof Buffer) return result;
  if (result instanceof ArrayBuffer) return Buffer.from(result);
  if (ArrayBuffer.isView(result)) {
    return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
  }
  if (result instanceof Blob) {
    const ab = await result.arrayBuffer();
    return Buffer.from(ab);
  }
  return Buffer.from(result as unknown as ArrayBuffer);
}
