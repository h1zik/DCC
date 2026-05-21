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

/** Dokumen terisolasi untuk render PDF (hanya isi editor — tanpa judul halaman). */
export function buildWikiPdfIframeDocument(bodyHtml: string): string {
  const safeBody = stripThemeClassesFromHtml(bodyHtml);
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 40px;
      width: 794px;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #111111;
      background: #ffffff;
    }
    .wiki-body > * + * { margin-top: 0.75em; }
    .wiki-body h1 { font-size: 1.875rem; font-weight: 700; line-height: 1.2; margin-top: 1.25em; color: #111; }
    .wiki-body h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.25; margin-top: 1.1em; color: #111; }
    .wiki-body h3 { font-size: 1.25rem; font-weight: 600; line-height: 1.3; margin-top: 1em; color: #111; }
    .wiki-body p { margin: 0; color: #111; }
    .wiki-body strong { font-weight: 700; }
    .wiki-body em { font-style: italic; }
    .wiki-body s { text-decoration: line-through; color: #52525b; }
    .wiki-body a { color: #2563eb; text-decoration: underline; }
    .wiki-body ul, .wiki-body ol { padding-left: 1.5rem; color: #111; }
    .wiki-body ul { list-style: disc; }
    .wiki-body ol { list-style: decimal; }
    .wiki-body li { margin: 0.25em 0; }
    .wiki-body ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    .wiki-body ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
    .wiki-body ul[data-type="taskList"] li[data-checked="true"] > div {
      color: #71717a;
      text-decoration: line-through;
    }
    .wiki-body blockquote {
      border-left: 3px solid #d4d4d8;
      padding-left: 0.75rem;
      margin-left: 0;
      color: #52525b;
      font-style: italic;
    }
    .wiki-body code { background: #f4f4f5; padding: 0.1em 0.35em; border-radius: 0.25rem; font-size: 0.9em; color: #111; }
    .wiki-body pre {
      background: #f4f4f5;
      color: #111;
      padding: 0.85rem 1rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      font-size: 0.875rem;
    }
    .wiki-body pre code { background: transparent; padding: 0; }
    .wiki-body hr { border: 0; border-top: 1px solid #e4e4e7; margin: 1.25em 0; }
    .wiki-body img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <article class="wiki-body">${safeBody}</article>
</body>
</html>`;
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
