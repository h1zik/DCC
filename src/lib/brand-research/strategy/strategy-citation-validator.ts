import type {
  CitationQualityReport,
  EvidenceRef,
  EvidenceSnapshot,
  StrategyFieldRationale,
} from "@/lib/brand-research/strategy/evidence-types";

const VALID_SOURCES = new Set([
  "review",
  "social",
  "visual",
  "competitor",
  "keyword",
  "trend",
  "usp",
  "product-discovery",
  "competitor-product",
  "portfolio",
]);

const MIN_SNIPPET_LEN = 12;
const PASS_THRESHOLD = 0.65;
// Fraction of a snippet's content words that must appear in the real evidence text
// for the snippet to count as grounded (rather than a likely hallucination).
const GROUNDING_OVERLAP_THRESHOLD = 0.5;

const STOPWORDS = new Set([
  "yang", "untuk", "dengan", "dari", "pada", "dan", "atau", "ini", "itu",
  "para", "lebih", "agar", "akan", "tidak", "juga", "karena", "dalam", "saya",
  "kami", "mereka", "konsumen", "produk", "brand", "merek", "sangat", "bisa",
  "the", "and", "for", "with", "from", "that", "this", "have", "more",
]);

/** Collect every string value in the evidence snapshot input into one token set. */
function buildEvidenceCorpus(input: Record<string, unknown>): Set<string> {
  const tokens = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === "string") {
      for (const w of v.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []) tokens.add(w);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };
  walk(input);
  return tokens;
}

/** A snippet is grounded when enough of its content words appear in the evidence. */
function isSnippetGrounded(snippet: string, corpus: Set<string>): boolean {
  const content = (snippet.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter(
    (w) => !STOPWORDS.has(w),
  );
  if (content.length === 0) return false;
  const hits = content.filter((w) => corpus.has(w)).length;
  return hits / content.length >= GROUNDING_OVERLAP_THRESHOLD;
}

function isValidRef(
  ref: EvidenceRef,
  sourceIdSet: Set<string>,
  corpus: Set<string>,
): { valid: boolean; reason?: string } {
  if (!VALID_SOURCES.has(ref.source)) {
    return { valid: false, reason: `source tidak valid: ${ref.source}` };
  }
  if (!ref.snippet || ref.snippet.trim().length < MIN_SNIPPET_LEN) {
    return { valid: false, reason: "snippet terlalu pendek atau kosong" };
  }
  if (ref.sourceId && !sourceIdSet.has(ref.sourceId)) {
    return { valid: false, reason: `sourceId tidak ada di evidence snapshot: ${ref.sourceId}` };
  }
  // Content grounding: the snippet must actually reflect the real evidence text,
  // not just be a well-formed string. This is what blocks invented quotes.
  if (corpus.size > 0 && !isSnippetGrounded(ref.snippet, corpus)) {
    return {
      valid: false,
      reason: "snippet tidak ditemukan di evidence (kemungkinan halusinasi)",
    };
  }
  return { valid: true };
}

export function validateStrategyCitations(input: {
  strategyRationales?: StrategyFieldRationale[];
  evidenceRefs?: EvidenceRef[];
  snapshot: EvidenceSnapshot;
}): CitationQualityReport {
  const sourceIdSet = new Set(
    input.snapshot.sourceRefs.map((r) => r.sourceId).filter(Boolean),
  );
  const corpus = buildEvidenceCorpus(input.snapshot.input ?? {});

  const allRefs: EvidenceRef[] = [];
  for (const r of input.strategyRationales ?? []) {
    if (Array.isArray(r.evidenceRefs)) {
      allRefs.push(...r.evidenceRefs);
    }
  }
  if (Array.isArray(input.evidenceRefs)) {
    allRefs.push(...input.evidenceRefs);
  }

  const invalidRefs: CitationQualityReport["invalidRefs"] = [];
  let validRefs = 0;

  for (const ref of allRefs) {
    const check = isValidRef(ref, sourceIdSet, corpus);
    if (check.valid) {
      validRefs += 1;
    } else {
      invalidRefs.push({
        field: ref.field,
        source: ref.source,
        sourceId: ref.sourceId,
        reason: check.reason ?? "invalid",
      });
    }
  }

  const totalRefs = allRefs.length;
  const score = totalRefs > 0 ? validRefs / totalRefs : 0;

  // passed reflects how much of the citation set is genuinely grounded in evidence.
  // Previously this also required invalidRefs.length === 0, which forced score to 1
  // whenever it could pass at all, making PASS_THRESHOLD dead code. Now the threshold
  // is live: a document with mostly hallucinated snippets will fail.
  return {
    score,
    totalRefs,
    validRefs,
    passed: totalRefs > 0 && score >= PASS_THRESHOLD,
    invalidRefs,
  };
}

export function buildCitationRepairPrompt(
  invalidRefs: CitationQualityReport["invalidRefs"],
  snapshot: EvidenceSnapshot,
): string {
  return `Perbaiki strategyRationales dan evidenceRefs pada output JSON sebelumnya.

Masalah kutipan yang ditemukan:
${JSON.stringify(invalidRefs, null, 2)}

sourceId yang VALID (hanya gunakan ini jika menyertakan sourceId):
${JSON.stringify(snapshot.sourceRefs.map((r) => ({ module: r.module, sourceId: r.sourceId, label: r.label })), null, 2)}

Aturan perbaikan:
- Setiap evidenceRef wajib punya snippet min. ${MIN_SNIPPET_LEN} karakter yang mengutip data nyata dari evidence snapshot.
- source harus salah satu: review, social, visual, competitor, keyword, trend, usp, product-discovery, portfolio
- Jangan mengubah isi strategi (brandPurpose, stp, dll) kecuali perlu menyesuaikan kutipan.
- Kembalikan JSON lengkap dengan field yang sama seperti sebelumnya.`;
}
