/**
 * Sinyal dokumen untuk skoring konten v2. File ini HARUS bebas dependensi
 * server/cheerio agar bisa dipakai di client (skor real-time di editor).
 * - Client: `extractSignalsFromDom` (DOMParser browser).
 * - Server: `extractSignalsFromHtml` di html-signals-server.ts (cheerio).
 */

export type DocHeading = { level: number; text: string };

export type DocSignals = {
  text: string;
  wordCount: number;
  headings: DocHeading[];
  h1Count: number;
  h2Count: number;
  paragraphs: string[];
  firstParagraph: string;
  linkCount: number;
  externalLinkCount: number;
  listCount: number;
  avgWordsPerSentence: number | null;
  maxParagraphWords: number;
  verifyMarkers: string[];
};

export function emptyDocSignals(): DocSignals {
  return {
    text: "",
    wordCount: 0,
    headings: [],
    h1Count: 0,
    h2Count: 0,
    paragraphs: [],
    firstParagraph: "",
    linkCount: 0,
    externalLinkCount: 0,
    listCount: 0,
    avgWordsPerSentence: null,
    maxParagraphWords: 0,
    verifyMarkers: [],
  };
}

/** Turunan bersama dari data mentah hasil parsing (dipakai kedua extractor). */
export function buildDocSignals(raw: {
  text: string;
  headings: DocHeading[];
  paragraphs: string[];
  links: { href: string }[];
  listCount: number;
  verifyMarkers: string[];
}): DocSignals {
  const text = raw.text.replace(/\s+/g, " ").trim();
  const words = text ? text.split(/\s+/) : [];
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const paragraphs = raw.paragraphs
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const externalLinkCount = raw.links.filter((l) =>
    /^https?:\/\//i.test(l.href),
  ).length;

  return {
    text,
    wordCount: words.length,
    headings: raw.headings,
    h1Count: raw.headings.filter((h) => h.level === 1).length,
    h2Count: raw.headings.filter((h) => h.level === 2).length,
    paragraphs,
    firstParagraph: paragraphs[0] ?? "",
    linkCount: raw.links.length,
    externalLinkCount,
    listCount: raw.listCount,
    avgWordsPerSentence: sentences.length ? words.length / sentences.length : null,
    maxParagraphWords: paragraphs.reduce(
      (max, p) => Math.max(max, p.split(/\s+/).length),
      0,
    ),
    verifyMarkers: raw.verifyMarkers,
  };
}

const VERIFY_RE = /<!--\s*verify:\s*([\s\S]*?)-->/gi;

export function extractVerifyMarkersFromHtml(html: string): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(VERIFY_RE.source, "gi");
  while ((match = re.exec(html)) !== null) {
    const note = match[1].trim();
    if (note) out.push(note);
  }
  return out;
}

/** Extractor client (browser DOMParser). Jangan panggil di server. */
export function extractSignalsFromDom(html: string): DocSignals {
  if (typeof DOMParser === "undefined") return emptyDocSignals();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const headings: DocHeading[] = [];
  doc.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) headings.push({ level: Number(el.tagName.slice(1)), text });
  });

  const paragraphs: string[] = [];
  doc.querySelectorAll("p").forEach((el) => {
    paragraphs.push(el.textContent ?? "");
  });

  const links: { href: string }[] = [];
  doc.querySelectorAll("a[href]").forEach((el) => {
    links.push({ href: el.getAttribute("href") ?? "" });
  });

  return buildDocSignals({
    text: doc.body?.textContent ?? "",
    headings,
    paragraphs,
    links,
    listCount: doc.querySelectorAll("ul, ol").length,
    verifyMarkers: extractVerifyMarkersFromHtml(html),
  });
}
