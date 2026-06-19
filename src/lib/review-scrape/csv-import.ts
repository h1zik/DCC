import type { NormalizedReview } from "@/lib/apify/normalize";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

const TEXT_HEADERS = new Set([
  "text",
  "review",
  "review_text",
  "content",
  "body",
  "comment",
  "ulasan",
]);

const AUTHOR_HEADERS = new Set(["author", "username", "user", "name", "penulis"]);
const RATING_HEADERS = new Set(["rating", "score", "stars", "star", "bintang"]);
const DATE_HEADERS = new Set(["date", "review_date", "created_at", "tanggal"]);
const ID_HEADERS = new Set(["id", "external_id", "review_id"]);

export function parseReviewCsv(content: string): NormalizedReview[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("File CSV kosong.");
  }

  const headerCells = parseCsvLine(lines[0]!);
  const headers = headerCells.map(normalizeHeader);

  const textIdx = headers.findIndex((h) => TEXT_HEADERS.has(h));
  if (textIdx < 0) {
    throw new Error(
      'CSV harus punya kolom teks review (mis. "text", "review", atau "ulasan").',
    );
  }

  const authorIdx = headers.findIndex((h) => AUTHOR_HEADERS.has(h));
  const ratingIdx = headers.findIndex((h) => RATING_HEADERS.has(h));
  const dateIdx = headers.findIndex((h) => DATE_HEADERS.has(h));
  const idIdx = headers.findIndex((h) => ID_HEADERS.has(h));

  const reviews: NormalizedReview[] = [];

  for (let row = 1; row < lines.length; row += 1) {
    const cells = parseCsvLine(lines[row]!);
    const text = (cells[textIdx] ?? "").trim();
    if (!text) continue;

    const ratingRaw = ratingIdx >= 0 ? cells[ratingIdx]?.trim() : "";
    let rating: number | null = null;
    if (ratingRaw) {
      const n = Number(ratingRaw.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n)) rating = n;
    }

    const dateRaw = dateIdx >= 0 ? cells[dateIdx]?.trim() : "";
    let reviewDate: Date | null = null;
    if (dateRaw) {
      const d = new Date(dateRaw);
      if (!Number.isNaN(d.getTime())) reviewDate = d;
    }

    reviews.push({
      externalId:
        (idIdx >= 0 ? cells[idIdx]?.trim() : "") || `csv-${row}`,
      author: authorIdx >= 0 ? cells[authorIdx]?.trim() || null : null,
      rating,
      text,
      reviewDate,
    });
  }

  if (reviews.length === 0) {
    throw new Error("Tidak ada baris review valid di CSV.");
  }

  return reviews;
}
