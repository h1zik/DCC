export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape HTML then convert `**bold**` to <strong>. */
export function inlineMarkdownToHtml(text: string): string {
  return esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** Markdown-style report body → safe HTML (paragraphs, lists, h3, bold). */
export function reportBodyToHtml(body: string): string {
  const lines = body.split("\n");
  const parts: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    parts.push(`<ul>${listBuffer.join("")}</ul>`);
    listBuffer = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flushList();
      parts.push("<br/>");
      continue;
    }
    if (t.startsWith("- ") || t.startsWith("* ")) {
      listBuffer.push(`<li>${inlineMarkdownToHtml(t.slice(2))}</li>`);
      continue;
    }
    flushList();
    if (t.startsWith("## ")) {
      parts.push(`<h3>${inlineMarkdownToHtml(t.slice(3))}</h3>`);
    } else {
      parts.push(`<p>${inlineMarkdownToHtml(t)}</p>`);
    }
  }

  flushList();
  return parts.join("\n");
}
