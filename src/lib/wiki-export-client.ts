import {
  buildWikiHtmlDocument,
  htmlToMarkdown,
  htmlToPlainText,
  sanitizeWikiFilename,
  type WikiExportFormat,
} from "@/lib/wiki-export";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return null;
    }
  }
  return null;
}

export async function downloadWikiPageFromApi(
  apiPath: string,
  format: "html" | "md" | "txt" | "docx",
): Promise<void> {
  const res = await fetch(apiPath, {
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Gagal mengunduh.");
  }
  const blob = await res.blob();
  const name =
    filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
    `wiki.${format}`;
  triggerBlobDownload(blob, name);
}

/**
 * PDF via engine blok-aware: transform HTML wiki → dokumen ber-`data-pdf-block`
 * → `downloadHtmlAsPdf` (page break jatuh di antara blok, bukan memotong teks).
 */
export async function downloadWikiPageAsPdf(title: string, contentHtml: string) {
  const [wikiPdf, { downloadHtmlAsPdf }] = await Promise.all([
    import("@/lib/wiki-pdf"),
    import("@/lib/research/research-pdf-client"),
  ]);
  const body = wikiPdf.prepareWikiHtmlForPdf(contentHtml);
  await downloadHtmlAsPdf(
    title,
    wikiPdf.buildWikiPdfDocument(title, body),
    sanitizeWikiFilename(title, "wiki"),
    {
      beforeCapture: wikiPdf.refineWikiPdfBlocks,
      // Band wiki sudah membawa margin CSS hingga awal blok berikutnya.
      blockGapPt: 0,
    },
  );
}

export function downloadWikiPageLocally(
  title: string,
  contentHtml: string,
  format: WikiExportFormat,
  /** Path API unduhan DOCX (satu-satunya format yang butuh server). */
  docxApiPath: string,
): Promise<void> {
  if (format === "pdf") {
    return downloadWikiPageAsPdf(title, contentHtml);
  }
  if (format === "docx") {
    return downloadWikiPageFromApi(docxApiPath, "docx");
  }
  if (format === "html") {
    const html = buildWikiHtmlDocument(title, contentHtml);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    triggerBlobDownload(blob, `${sanitizeWikiFilename(title, "wiki")}.html`);
    return Promise.resolve();
  }
  if (format === "md") {
    const md = `# ${title}\n\n${htmlToMarkdown(contentHtml)}`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    triggerBlobDownload(blob, `${sanitizeWikiFilename(title, "wiki")}.md`);
    return Promise.resolve();
  }
  const txt = `${title}\n\n${htmlToPlainText(contentHtml)}`;
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  triggerBlobDownload(blob, `${sanitizeWikiFilename(title, "wiki")}.txt`);
  return Promise.resolve();
}
