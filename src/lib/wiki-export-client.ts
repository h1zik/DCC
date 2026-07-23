import {
  buildWikiHtmlDocument,
  htmlToMarkdown,
  htmlToPlainText,
  sanitizeWikiFilename,
  type WikiExportFormat,
} from "@/lib/wiki-export";
import { triggerBlobDownload } from "@/lib/download-file-client";

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
  format: "html" | "md" | "txt" | "docx" | "pdf",
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

export function downloadWikiPageLocally(
  title: string,
  contentHtml: string,
  format: WikiExportFormat,
  /** Bangun path API unduhan untuk format yang butuh render server (docx/pdf). */
  buildServerApiPath: (format: "docx" | "pdf") => string,
): Promise<void> {
  if (format === "pdf") {
    return downloadWikiPageFromApi(buildServerApiPath("pdf"), "pdf");
  }
  if (format === "docx") {
    return downloadWikiPageFromApi(buildServerApiPath("docx"), "docx");
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
