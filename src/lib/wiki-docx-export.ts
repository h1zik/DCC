import HTMLtoDOCX from "html-to-docx";
import { buildWikiHtmlDocument, stripThemeClassesFromHtml } from "@/lib/wiki-export";
import { solidHighlightColor } from "@/lib/editor-colors";

/** html-to-docx tidak mendukung hex 8 digit (highlight ber-alpha) — petakan ke solid. */
function normalizeHighlightColorsForDocx(html: string): string {
  return html.replace(
    /background-color:\s*(#[0-9a-fA-F]{8}|#[0-9a-fA-F]{4})\b/g,
    (_match, hex: string) => `background-color: ${solidHighlightColor(hex)}`,
  );
}

/** Buffer DOCX — kompatibel Word, LibreOffice, Google Docs. */
export async function buildWikiDocxBuffer(
  title: string,
  bodyHtml: string,
): Promise<Buffer> {
  const safeTitle = title.trim() || "Tanpa judul";
  const html = buildWikiHtmlDocument(
    safeTitle,
    normalizeHighlightColorsForDocx(stripThemeClassesFromHtml(bodyHtml)),
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
