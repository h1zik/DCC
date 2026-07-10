export type WikiSlashCommandId =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "codeBlock"
  | "table"
  | "divider"
  | "image"
  | "file"
  | "embed";

export type WikiSlashCommand = {
  id: WikiSlashCommandId;
  label: string;
  description: string;
  keywords: string[];
};

export const WIKI_SLASH_COMMANDS: WikiSlashCommand[] = [
  { id: "paragraph", label: "Teks", description: "Paragraf biasa", keywords: ["text", "paragraph"] },
  { id: "heading1", label: "Heading 1", description: "Judul bagian utama", keywords: ["h1", "judul"] },
  { id: "heading2", label: "Heading 2", description: "Judul bagian", keywords: ["h2", "judul"] },
  { id: "heading3", label: "Heading 3", description: "Subjudul", keywords: ["h3", "subjudul"] },
  { id: "bulletList", label: "Daftar poin", description: "Daftar dengan bullet", keywords: ["bullet", "list"] },
  { id: "orderedList", label: "Daftar nomor", description: "Daftar bernomor", keywords: ["number", "list"] },
  { id: "taskList", label: "Checklist", description: "Daftar tugas interaktif", keywords: ["todo", "task", "check"] },
  { id: "blockquote", label: "Kutipan", description: "Sorot kutipan penting", keywords: ["quote"] },
  { id: "codeBlock", label: "Kode", description: "Blok kode dengan syntax highlight", keywords: ["code", "snippet"] },
  { id: "table", label: "Tabel", description: "Tabel 3 × 3", keywords: ["grid"] },
  { id: "divider", label: "Divider", description: "Garis pemisah", keywords: ["line", "hr"] },
  { id: "image", label: "Gambar", description: "Unggah atau tautkan gambar", keywords: ["photo", "upload"] },
  { id: "file", label: "File", description: "Unggah lampiran", keywords: ["attachment", "upload"] },
  { id: "embed", label: "Embed", description: "Sematkan video YouTube", keywords: ["youtube", "video", "link"] },
];

export function filterWikiSlashCommands(query: string): WikiSlashCommand[] {
  const q = query.trim().toLocaleLowerCase("id-ID");
  if (!q) return WIKI_SLASH_COMMANDS;
  return WIKI_SLASH_COMMANDS.filter((item) =>
    [item.label, item.description, ...item.keywords]
      .join(" ")
      .toLocaleLowerCase("id-ID")
      .includes(q),
  );
}

export function normalizeWikiEmbedUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Membersihkan noise khas Word/Google Docs tanpa membuang struktur semantik.
 * Parser ProseMirror tetap menjadi lapisan normalisasi HTML berikutnya.
 */
export function cleanRichTextPasteHtml(html: string): string {
  return html
    .replace(/<!--(?:.|[\r\n])*?-->/g, "")
    .replace(/<\/?(?:meta|link|style|script)\b[^>]*>/gi, "")
    .replace(/\sclass=("|')Mso[^"']*\1/gi, "")
    .replace(/\s(?:lang|dir)=("|')[^"']*\1/gi, "")
    .replace(/mso-[^:;"']+\s*:[^;"']*;?/gi, "")
    .replace(/font-family\s*:[^;"']*;?/gi, "")
    .replace(/\sstyle=("|')\s*\1/gi, "")
    .trim();
}
