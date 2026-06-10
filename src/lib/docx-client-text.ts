import { unzipSync } from "fflate";

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    );
}

/**
 * Ekstrak teks per paragraf. Word memecah satu kata menjadi beberapa
 * run (`<w:t>`) — run dalam paragraf yang sama HARUS digabung tanpa
 * pemisah, kalau tidak "Psychographics" menjadi "Psycho graphics".
 */
function extractParagraphText(paragraphXml: string): string {
  let text = "";
  const tokens = paragraphXml.matchAll(
    /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g,
  );
  for (const token of tokens) {
    if (token[1] !== undefined) {
      text += decodeXmlEntities(token[1]);
    } else if (token[0].startsWith("<w:tab")) {
      text += "\t";
    } else {
      text += "\n";
    }
  }
  return text;
}

export async function extractDocxTextFromUrl(src: string): Promise<string> {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Gagal memuat DOCX.");
  const buffer = await res.arrayBuffer();
  const files = unzipSync(new Uint8Array(buffer));
  const docXml = files["word/document.xml"];
  if (!docXml) return "";

  const xml = new TextDecoder("utf-8").decode(docXml);
  const paragraphs = [...xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((m) =>
    extractParagraphText(m[0]),
  );

  return paragraphs
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isDocxMime(mime: string, fileName?: string) {
  const m = mime.toLowerCase();
  if (
    m ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return true;
  }
  return fileName?.toLowerCase().endsWith(".docx") ?? false;
}
