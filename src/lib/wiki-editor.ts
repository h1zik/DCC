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
  | "callout"
  | "toggle"
  | "table"
  | "divider"
  | "image"
  | "file"
  | "embed";

export type WikiSlashCommandSection = "Dasar" | "Daftar" | "Media" | "Lanjutan";

export type WikiSlashCommand = {
  id: WikiSlashCommandId;
  label: string;
  description: string;
  keywords: string[];
  section: WikiSlashCommandSection;
  /** Key ikon — dipetakan ke komponen lucide di UI (file ini bebas dependensi UI). */
  icon: string;
};

export const WIKI_SLASH_COMMANDS: WikiSlashCommand[] = [
  { id: "paragraph", label: "Teks", description: "Paragraf biasa", keywords: ["text", "paragraph"], section: "Dasar", icon: "pilcrow" },
  { id: "heading1", label: "Heading 1", description: "Judul bagian utama", keywords: ["h1", "judul"], section: "Dasar", icon: "heading-1" },
  { id: "heading2", label: "Heading 2", description: "Judul bagian", keywords: ["h2", "judul"], section: "Dasar", icon: "heading-2" },
  { id: "heading3", label: "Heading 3", description: "Subjudul", keywords: ["h3", "subjudul"], section: "Dasar", icon: "heading-3" },
  { id: "blockquote", label: "Kutipan", description: "Sorot kutipan penting", keywords: ["quote"], section: "Dasar", icon: "quote" },
  { id: "divider", label: "Divider", description: "Garis pemisah", keywords: ["line", "hr"], section: "Dasar", icon: "minus" },
  { id: "bulletList", label: "Daftar poin", description: "Daftar dengan bullet", keywords: ["bullet", "list"], section: "Daftar", icon: "list" },
  { id: "orderedList", label: "Daftar nomor", description: "Daftar bernomor", keywords: ["number", "list"], section: "Daftar", icon: "list-ordered" },
  { id: "taskList", label: "Checklist", description: "Daftar tugas interaktif", keywords: ["todo", "task", "check"], section: "Daftar", icon: "list-checks" },
  { id: "image", label: "Gambar", description: "Unggah atau tautkan gambar", keywords: ["photo", "upload"], section: "Media", icon: "image" },
  { id: "file", label: "File", description: "Unggah lampiran", keywords: ["attachment", "upload"], section: "Media", icon: "file-up" },
  { id: "embed", label: "Embed", description: "Sematkan video YouTube", keywords: ["youtube", "video", "link"], section: "Media", icon: "braces" },
  { id: "table", label: "Tabel", description: "Tabel 3 × 3", keywords: ["grid"], section: "Lanjutan", icon: "table" },
  { id: "codeBlock", label: "Kode", description: "Blok kode dengan syntax highlight", keywords: ["code", "snippet"], section: "Lanjutan", icon: "code" },
  { id: "callout", label: "Callout", description: "Kotak sorotan berwarna", keywords: ["info", "tip", "warning", "perhatian", "note", "catatan"], section: "Lanjutan", icon: "lightbulb" },
  { id: "toggle", label: "Toggle list", description: "Blok yang bisa dilipat", keywords: ["collapse", "details", "lipat", "accordion"], section: "Lanjutan", icon: "list-collapse" },
];

export function filterWikiSlashCommands(query: string): WikiSlashCommand[] {
  const q = query.trim().toLocaleLowerCase("id-ID");
  if (!q) return WIKI_SLASH_COMMANDS;
  const scored = WIKI_SLASH_COMMANDS.map((item) => {
    const label = item.label.toLocaleLowerCase("id-ID");
    let score: number | null = null;
    if (label.startsWith(q)) score = 0;
    else if (label.includes(q)) score = 1;
    else if (
      [item.description, ...item.keywords].join(" ").toLocaleLowerCase("id-ID").includes(q)
    ) {
      score = 2;
    }
    return score == null ? null : { item, score };
  }).filter((entry): entry is { item: WikiSlashCommand; score: number } => entry != null);
  return scored.sort((a, b) => a.score - b.score).map((entry) => entry.item);
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
 *
 * PENTING: jangan menambah aturan yang menghapus atribut `data-*` atau style
 * `text-align`/`color`/`background-color` — node callout/toggle/highlight dan
 * perataan teks bergantung pada atribut tersebut saat paste antar-halaman.
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
