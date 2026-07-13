import TurndownService from "turndown";

/**
 * Builder ekspor artikel siap pakai (HTML bersih / Markdown / HTML untuk DOCX).
 * Pure agar mudah di-test.
 */

export type ExportableDraft = {
  title: string;
  targetKeyword: string | null;
  contentHtml: string;
  metaTitle: string | null;
  metaDescription: string | null;
  slug: string | null;
};

/** Bersihkan HTML editor: buang komentar verify & artefak TipTap. */
export function buildCleanHtml(draft: ExportableDraft): string {
  let html = draft.contentHtml
    .replace(/<!--\s*verify:[\s\S]*?-->/gi, "")
    .replace(/<p>\s*<\/p>/g, "")
    .trim();

  // Pastikan ada tepat satu H1 di awal.
  if (!/<h1[\s>]/i.test(html)) {
    html = `<h1>${escapeHtml(draft.title)}</h1>\n${html}`;
  }
  return html;
}

/** Markdown + front-matter meta (siap tempel ke CMS berbasis markdown). */
export function buildMarkdown(draft: ExportableDraft): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  const body = turndown.turndown(buildCleanHtml(draft));

  const fm = [
    "---",
    `title: ${yamlString(draft.title)}`,
    draft.metaTitle ? `meta_title: ${yamlString(draft.metaTitle)}` : null,
    draft.metaDescription
      ? `meta_description: ${yamlString(draft.metaDescription)}`
      : null,
    draft.slug ? `slug: ${yamlString(draft.slug)}` : null,
    draft.targetKeyword ? `keyword: ${yamlString(draft.targetKeyword)}` : null,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  return `${fm}\n\n${body}\n`;
}

/** HTML dokumen untuk html-to-docx (meta di bagian atas sebagai info blok). */
export function buildDocxHtml(draft: ExportableDraft): string {
  const metaRows = [
    draft.metaTitle ? `<tr><td><b>Meta title</b></td><td>${escapeHtml(draft.metaTitle)}</td></tr>` : null,
    draft.metaDescription
      ? `<tr><td><b>Meta description</b></td><td>${escapeHtml(draft.metaDescription)}</td></tr>`
      : null,
    draft.slug ? `<tr><td><b>Slug</b></td><td>${escapeHtml(draft.slug)}</td></tr>` : null,
    draft.targetKeyword
      ? `<tr><td><b>Keyword</b></td><td>${escapeHtml(draft.targetKeyword)}</td></tr>`
      : null,
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${metaRows ? `<table border="1" cellpadding="6" cellspacing="0">${metaRows}</table><br/>` : ""}
${buildCleanHtml(draft)}
</body></html>`;
}

/** Ekstrak daftar klaim yang perlu diverifikasi dari marker <!-- verify: ... -->. */
export function extractVerifyMarkers(contentHtml: string): string[] {
  const out: string[] = [];
  const re = /<!--\s*verify:\s*([\s\S]*?)-->/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(contentHtml)) !== null) {
    const note = match[1].trim();
    if (note) out.push(note);
  }
  return out;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}
