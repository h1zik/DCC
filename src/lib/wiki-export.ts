import TurndownService from "turndown";

export type WikiExportFormat = "html" | "md" | "txt" | "pdf" | "docx";

export function wikiDownloadApiPath(
  roomId: string,
  viewId: string,
  pageId: string,
  format: WikiExportFormat,
): string {
  return `/api/rooms/${roomId}/views/${viewId}/wiki/${pageId}/download?format=${format}`;
}

export function personalNoteDownloadApiPath(
  noteId: string,
  format: WikiExportFormat,
): string {
  return `/api/personal/notes/${noteId}/download?format=${format}`;
}

export function sanitizeWikiFilename(title: string, fallback: string): string {
  const base =
    title
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || fallback;
  return base || "wiki-page";
}

export function htmlToPlainText(html: string): string {
  if (!html.trim()) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? div.innerText ?? "").trim();
}

export function htmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  td.addRule("taskList", {
    filter: (node) =>
      node.nodeName === "LI" &&
      node.getAttribute("data-type") === "taskItem",
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
      return `- [${checked ? "x" : " "}] ${content.trim()}\n`;
    },
  });
  return td.turndown(html || "<p></p>").trim();
}

/** Hapus class tema app agar html2canvas tidak mem-parse warna lab/oklch. */
export function stripThemeClassesFromHtml(html: string): string {
  return html
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/\sclass='[^']*'/gi, "");
}

export function buildWikiHtmlDocument(title: string, bodyHtml: string): string {
  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.7; max-width: 48rem; margin: 2rem auto; padding: 0 1rem; color: #111; }
    h1 { font-size: 1.75rem; margin-bottom: 1rem; }
    a { color: #2563eb; text-decoration: underline; }
    img { max-width: 100%; height: auto; }
    pre, code { background: #f4f4f5; border-radius: 0.25rem; }
    pre { padding: 1rem; overflow-x: auto; }
    blockquote { border-left: 3px solid #d4d4d8; padding-left: 1rem; color: #52525b; }
    ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <article class="wiki-content">${bodyHtml}</article>
</body>
</html>`;
}

export function attachmentDisposition(filename: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export const WIKI_EXPORT_MIME: Record<WikiExportFormat, string> = {
  html: "text/html; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  pdf: "application/pdf",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const WIKI_EXPORT_EXT: Record<WikiExportFormat, string> = {
  html: "html",
  md: "md",
  txt: "txt",
  pdf: "pdf",
  docx: "docx",
};
