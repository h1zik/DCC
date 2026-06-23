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

function isValidRef(
  ref: EvidenceRef,
  sourceIdSet: Set<string>,
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
    const check = isValidRef(ref, sourceIdSet);
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

  return {
    score,
    totalRefs,
    validRefs,
    passed: score >= PASS_THRESHOLD && invalidRefs.length === 0,
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
