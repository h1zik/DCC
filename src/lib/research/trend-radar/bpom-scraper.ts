import "server-only";

import * as cheerio from "cheerio";

export type BpomTrendSignal = {
  term: string;
  source: string;
  productName?: string;
  registrationNo?: string;
  brandName?: string;
};

const BPOM_BASE = "https://cekbpom.pom.go.id";
const BPOM_KOSMETIKA_SEARCH = `${BPOM_BASE}/produk-kosmetika`;
const REQUEST_DELAY_MS = 6_000;
const MAX_KEYWORDS = 6;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/:$/, "");
}

function parseSearchTable(html: string): BpomTrendSignal[] {
  const $ = cheerio.load(html);
  const signals: BpomTrendSignal[] = [];
  const seen = new Set<string>();

  $("table").each((_, table) => {
    const headers: string[] = [];
    $(table)
      .find("th")
      .each((__, th) => {
        headers.push(normalizeHeader($(th).text()));
      });

    if (headers.length === 0) return;

    $(table)
      .find("tr")
      .each((rowIdx, tr) => {
        if (rowIdx === 0 && $(tr).find("th").length > 0) return;

        const cells = $(tr)
          .find("td")
          .map((__, td) => $(td).text().trim())
          .get();

        if (cells.length === 0) return;

        const row: Record<string, string> = {};
        for (let i = 0; i < Math.min(headers.length, cells.length); i++) {
          const h = headers[i];
          if (h) row[h] = cells[i] ?? "";
        }

        const productName =
          row["nama produk"] ??
          row["nama dagang"] ??
          cells.find((c) => c.length > 2) ??
          "";
        const registrationNo =
          row["no. registrasi"] ?? row["nomor registrasi"] ?? undefined;
        const brandName = row["merk"] ?? row["nama dagang"] ?? undefined;

        if (!productName || productName.length < 2) return;

        const dedupeKey = `${registrationNo ?? ""}:${productName}`.toLowerCase();
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        signals.push({
          term: productName,
          source: "bpom_kosmetika",
          productName,
          registrationNo,
          brandName,
        });
      });
  });

  return signals.slice(0, 30);
}

async function fetchBpomSearchPage(keyword: string): Promise<string | null> {
  const url = `${BPOM_KOSMETIKA_SEARCH}?q=${encodeURIComponent(keyword)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.warn("[trend-radar/bpom] HTTP", res.status, keyword);
      return null;
    }

    return await res.text();
  } catch (err) {
    console.warn("[trend-radar/bpom] fetch gagal", keyword, err);
    return null;
  }
}

export async function fetchBpomTrendSignals(
  seedKeywords: string[] = [],
): Promise<BpomTrendSignal[]> {
  const seeds =
    seedKeywords.length > 0
      ? [...new Set(seedKeywords)].slice(0, MAX_KEYWORDS)
      : ["serum", "sunscreen", "moisturizer", "body lotion", "brightening"];

  const all: BpomTrendSignal[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < seeds.length; i++) {
    if (i > 0) await sleep(REQUEST_DELAY_MS);

    const html = await fetchBpomSearchPage(seeds[i]!);
    if (!html) continue;

    for (const signal of parseSearchTable(html)) {
      const key = signal.term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(signal);
    }
  }

  return all.slice(0, 50);
}

/** Quick probe for dashboard health. */
export async function probeBpomReachable(): Promise<boolean> {
  const html = await fetchBpomSearchPage("serum");
  return html !== null && html.length > 500;
}
