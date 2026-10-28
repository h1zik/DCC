/**
 * Aturan AI Visibility (pure): deteksi apakah brand disebut di jawaban AI
 * (teks + sitasi), klasifikasi error cek, dan ringkasan run.
 */

/** Kategori kegagalan satu cek (untuk notice & tampilan). */
export type AiVisibilityErrorKind = "balance" | "access" | "timeout" | "other";

export type AiVisibilityResult = {
  keyword: string;
  platform: string;
  prompt: string;
  mentioned: boolean;
  matchedTerms: string[];
  /** Cuplikan jawaban di sekitar mention (atau awal jawaban). */
  excerpt: string;
  citations: string[];
  error?: string;
  errorKind?: AiVisibilityErrorKind;
  /** Nama model DataForSEO yang dipakai. */
  modelName?: string;
  /** True bila daftar model gagal dimuat dan model fallback hard-coded dipakai. */
  modelFallback?: boolean;
};

export type AiVisibilityPlatformSummary = {
  /** Cek yang berhasil (tanpa error) — penyebut `rate`. */
  total: number;
  mentioned: number;
  /** 0–100 dari cek berhasil; 0 bila tidak ada cek berhasil. */
  rate: number;
  /** Cek yang gagal (error) — tidak masuk penyebut rate. */
  failed: number;
};

export type AiVisibilitySummary = {
  /** 0–100: persentase cek BERHASIL dengan mention (cek gagal tidak dihitung). */
  mentionRate: number;
  /** Jumlah cek berhasil (= penyebut mentionRate). */
  totalChecks: number;
  mentionedChecks: number;
  /** Jumlah cek gagal (error). */
  failedChecks: number;
  /** Jumlah cek yang memakai model fallback (daftar model gagal dimuat). */
  fallbackChecks: number;
  byPlatform: Record<string, AiVisibilityPlatformSummary>;
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Hostname URL tanpa `www.` (lowercase); null bila bukan URL valid. */
function citationHostname(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const host = new URL(withScheme).hostname.toLowerCase();
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Term domain cocok bila hostname sama persis atau subdomain-nya. */
function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Regex kemunculan domain di teks bebas: tidak diapit karakter domain
 * (`[A-Za-z0-9-]`) dan tidak diikuti label domain lain (`glowify.co` tidak
 * cocok dengan `glowify.com.au`). Prefiks `www.` diizinkan.
 */
function domainInTextRegex(domain: string): RegExp {
  return new RegExp(
    `(?<![A-Za-z0-9-])(?:www\\.)?${escapeRegex(domain)}(?![A-Za-z0-9-])(?!\\.[A-Za-z])`,
    "i",
  );
}

/** Normalisasi term domain: buang skema, `www.`, dan path. */
function normalizeDomainTerm(term: string): string {
  return term
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

/**
 * Cek mention brand di teks jawaban + URL sitasi.
 * - Term domain (mengandung titik): hostname sitasi harus sama/subdomain, dan
 *   kemunculan di teks harus berbatas (bukan substring: `glowify.co` tidak
 *   cocok dengan `glowify.com.au` atau `notglowify.co`).
 * - Term nama: kata utuh, case-insensitive.
 */
export function detectBrandMention(
  answerText: string,
  citations: string[],
  brandTerms: string[],
): { mentioned: boolean; matchedTerms: string[] } {
  const matched = new Set<string>();
  const citationText = citations.join(" ");
  const hostnames = citations
    .map(citationHostname)
    .filter((h): h is string => h != null);

  for (const raw of brandTerms) {
    const term = raw.trim().toLowerCase();
    if (!term) continue;
    if (term.includes(".")) {
      const domain = normalizeDomainTerm(term);
      if (!domain) continue;
      const inCitations = hostnames.some((h) => hostnameMatchesDomain(h, domain));
      const re = domainInTextRegex(domain);
      if (inCitations || re.test(answerText) || re.test(citationText)) {
        matched.add(raw.trim());
      }
    } else {
      const re = new RegExp(
        `(^|[^\\p{L}\\p{N}])${escapeRegex(term)}($|[^\\p{L}\\p{N}])`,
        "iu",
      );
      if (re.test(answerText) || re.test(citationText)) matched.add(raw.trim());
    }
  }
  return { mentioned: matched.size > 0, matchedTerms: [...matched] };
}

/** Cuplikan ±120 karakter di sekitar mention pertama (atau awal teks). */
export function buildExcerpt(
  answerText: string,
  matchedTerms: string[],
  maxLen = 260,
): string {
  const clean = answerText.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const term = matchedTerms[0]?.toLowerCase();
  if (term) {
    const idx = clean.toLowerCase().indexOf(term);
    if (idx >= 0) {
      const start = Math.max(0, idx - 120);
      const end = Math.min(clean.length, idx + term.length + 120);
      return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
    }
  }
  return clean.slice(0, maxLen) + (clean.length > maxLen ? "…" : "");
}

/**
 * Klasifikasi error cek dari bentuk error DataForSEO (pure; analyzer memetakan
 * `DataForSeoError` ke bentuk ini).
 * - balanceExhausted → "balance"
 * - status 402xx–404xx (atau HTTP 402/403/404) → "access" (endpoint/akses)
 * - tanpa status code + pesan timeout/abort/jaringan → "timeout"
 */
export function classifyAiVisibilityError(err: {
  message?: string | null;
  statusCode?: number | null;
  balanceExhausted?: boolean;
}): AiVisibilityErrorKind {
  if (err.balanceExhausted) return "balance";
  const code = err.statusCode;
  if (code != null) {
    if (code >= 40200 && code < 40500) return "access";
    if (code === 402 || code === 403 || code === 404) return "access";
    return "other";
  }
  const msg = (err.message ?? "").toLowerCase();
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("abort") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("jaringan") ||
    msg.includes("econn") ||
    msg.includes("socket")
  ) {
    return "timeout";
  }
  return "other";
}

const ERROR_KIND_LABELS: Record<AiVisibilityErrorKind, string> = {
  balance: "saldo DataForSEO habis",
  access: "akses/endpoint AI Optimization tidak tersedia di akun DataForSEO",
  timeout: "timeout/jaringan",
  other: "error lain",
};

/**
 * Notice kegagalan run: "N cek gagal — 2 saldo DataForSEO habis, 1 timeout/
 * jaringan." plus catatan model fallback bila ada. Null bila bersih.
 */
export function buildFailureNotice(results: AiVisibilityResult[]): string | null {
  const failed = results.filter((r) => r.error);
  const fallback = results.filter((r) => r.modelFallback).length;
  const parts: string[] = [];

  if (failed.length > 0) {
    const counts = new Map<AiVisibilityErrorKind, number>();
    for (const r of failed) {
      const kind = r.errorKind ?? "other";
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    const order: AiVisibilityErrorKind[] = ["balance", "access", "timeout", "other"];
    const buckets = order
      .filter((k) => counts.has(k))
      .map((k) => `${counts.get(k)} ${ERROR_KIND_LABELS[k]}`);
    parts.push(`${failed.length} cek gagal — ${buckets.join(", ")}.`);
  }

  if (fallback > 0) {
    parts.push(
      `${fallback} cek memakai model fallback karena daftar model DataForSEO gagal dimuat (model mungkin sudah tidak tersedia).`,
    );
  }

  return parts.length ? parts.join(" ") : null;
}

export function buildRunSummary(
  results: AiVisibilityResult[],
): AiVisibilitySummary {
  const byPlatform: AiVisibilitySummary["byPlatform"] = {};
  const ensure = (platform: string): AiVisibilityPlatformSummary => {
    const entry =
      byPlatform[platform] ?? { total: 0, mentioned: 0, rate: 0, failed: 0 };
    byPlatform[platform] = entry;
    return entry;
  };

  let valid = 0;
  let mentioned = 0;
  let failed = 0;
  let fallback = 0;
  for (const r of results) {
    const entry = ensure(r.platform);
    if (r.modelFallback) fallback += 1;
    if (r.error) {
      failed += 1;
      entry.failed += 1;
      continue;
    }
    valid += 1;
    entry.total += 1;
    if (r.mentioned) {
      mentioned += 1;
      entry.mentioned += 1;
    }
  }
  for (const p of Object.keys(byPlatform)) {
    const e = byPlatform[p];
    e.rate = e.total > 0 ? Math.round((e.mentioned / e.total) * 100) : 0;
  }
  return {
    mentionRate: valid > 0 ? Math.round((mentioned / valid) * 100) : 0,
    totalChecks: valid,
    mentionedChecks: mentioned,
    failedChecks: failed,
    fallbackChecks: fallback,
    byPlatform,
  };
}
