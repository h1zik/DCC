import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import { absolutePathFromStoredPublicPath } from "@/lib/upload-storage";

/** Batas baca file untuk ekstraksi teks (10 MB). */
export const MAX_DOCUMENT_TEXT_EXTRACT_BYTES = 10 * 1024 * 1024;

/** Batas karakter teks yang dikembalikan ke AI. */
export const MAX_DOCUMENT_TEXT_CHARS = 50_000;

export type DocumentTextExtraction = {
  text: string | null;
  method:
    | "plain"
    | "markdown"
    | "csv"
    | "json"
    | "html"
    | "docx"
    | "pdf"
    | "unsupported"
    | "too_large"
    | "missing_file";
  truncated: boolean;
  note?: string;
};

function truncateText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_DOCUMENT_TEXT_CHARS) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, MAX_DOCUMENT_TEXT_CHARS)}\n\n…(dipotong, ${text.length - MAX_DOCUMENT_TEXT_CHARS} karakter sisanya tidak ditampilkan)`,
    truncated: true,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function extractDocxText(buffer: Buffer): string {
  const files = unzipSync(new Uint8Array(buffer));
  const docXml = files["word/document.xml"];
  if (!docXml) return "";

  const xml = new TextDecoder("utf-8").decode(docXml);
  const parts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return (result.text ?? "").trim();
}

export function isLikelyTextMime(mimeType: string, fileName: string): boolean {
  const mime = mimeType.toLowerCase();
  const ext = path.extname(fileName).toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (mime === "application/json") return true;
  if (mime === "application/xml" || mime === "text/xml") return true;
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    return true;
  }
  if (mime === "application/pdf" || ext === ".pdf") return true;
  if (mime === "text/html" || ext === ".html" || ext === ".htm") return true;
  return false;
}

export async function extractTextFromDocumentBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<DocumentTextExtraction> {
  const mime = mimeType.toLowerCase();
  const ext = path.extname(fileName).toLowerCase();

  if (buffer.byteLength > MAX_DOCUMENT_TEXT_EXTRACT_BYTES) {
    return {
      text: null,
      method: "too_large",
      truncated: false,
      note: `File lebih dari ${Math.round(MAX_DOCUMENT_TEXT_EXTRACT_BYTES / (1024 * 1024))} MB — ekstraksi teks dilewati.`,
    };
  }

  try {
    let raw = "";

    if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === ".docx"
    ) {
      raw = extractDocxText(buffer);
      const { text, truncated } = truncateText(raw);
      return {
        text: text || null,
        method: "docx",
        truncated,
        note: text ? undefined : "DOCX tidak berisi teks yang terbaca.",
      };
    }

    if (mime === "application/pdf" || ext === ".pdf") {
      raw = await extractPdfText(buffer);
      const { text, truncated } = truncateText(raw);
      return {
        text: text || null,
        method: "pdf",
        truncated,
        note: text ? undefined : "PDF tidak berisi teks (mungkin scan/gambar).",
      };
    }

    if (mime === "text/html" || ext === ".html" || ext === ".htm") {
      raw = stripHtml(buffer.toString("utf-8"));
      const { text, truncated } = truncateText(raw);
      return { text: text || null, method: "html", truncated };
    }

    if (mime === "text/markdown" || ext === ".md") {
      raw = buffer.toString("utf-8");
      const { text, truncated } = truncateText(raw);
      return { text, method: "markdown", truncated };
    }

    if (mime === "text/csv" || ext === ".csv") {
      raw = buffer.toString("utf-8");
      const { text, truncated } = truncateText(raw);
      return { text, method: "csv", truncated };
    }

    if (mime === "application/json" || ext === ".json") {
      raw = buffer.toString("utf-8");
      const { text, truncated } = truncateText(raw);
      return { text, method: "json", truncated };
    }

    if (mime.startsWith("text/") || ext === ".txt" || ext === ".log") {
      raw = buffer.toString("utf-8");
      const { text, truncated } = truncateText(raw);
      return { text, method: "plain", truncated };
    }

    return {
      text: null,
      method: "unsupported",
      truncated: false,
      note: `Tipe file ${mimeType || ext || "unknown"} belum didukung ekstraksi teks (mis. gambar/video). Metadata tetap tersedia.`,
    };
  } catch (err) {
    return {
      text: null,
      method: "unsupported",
      truncated: false,
      note: err instanceof Error ? err.message : "Gagal mengekstrak teks.",
    };
  }
}

export async function readRoomDocumentText(params: {
  publicPath: string;
  mimeType: string;
  fileName: string;
}): Promise<DocumentTextExtraction> {
  const abs = absolutePathFromStoredPublicPath(params.publicPath);
  if (!abs) {
    return {
      text: null,
      method: "missing_file",
      truncated: false,
      note: "Path file tidak valid.",
    };
  }

  try {
    const st = await stat(abs);
    if (!st.isFile()) {
      return {
        text: null,
        method: "missing_file",
        truncated: false,
        note: "File fisik tidak ditemukan di server.",
      };
    }

    if (st.size > MAX_DOCUMENT_TEXT_EXTRACT_BYTES) {
      return {
        text: null,
        method: "too_large",
        truncated: false,
        note: `File ${Math.round(st.size / (1024 * 1024))} MB — maks ekstraksi ${Math.round(MAX_DOCUMENT_TEXT_EXTRACT_BYTES / (1024 * 1024))} MB.`,
      };
    }

    const buffer = await readFile(abs);
    return extractTextFromDocumentBuffer(buffer, params.mimeType, params.fileName);
  } catch {
    return {
      text: null,
      method: "missing_file",
      truncated: false,
      note: "File fisik tidak dapat dibaca dari storage.",
    };
  }
}
