import type { UspGatheredContext } from "@/lib/research/usp-gap/gather-context";

/**
 * Confidence cap berbasis DATA (bukan self-report model): semakin sedikit
 * modul riset yang benar-benar berisi data, semakin rendah keyakinan maksimum
 * yang boleh ditampilkan pada verdict GO/WATCH/AVOID. LLM cenderung overconfident
 * dan tidak terkalibrasi — angka keyakinan harus dibatasi oleh kecukupan data.
 */
export function countContextModulesWithData(ctx: UspGatheredContext): number {
  let count = 0;
  if (ctx.reviewIntel) count += 1;
  if (ctx.competitor) count += 1;
  if (ctx.trendRadar && ctx.trendRadar.items.length > 0) count += 1;
  if (ctx.keywordIntel) count += 1;
  if (ctx.socialListening) count += 1;
  if (ctx.productDiscovery && ctx.productDiscovery.length > 0) count += 1;
  if (ctx.competitorProducts && ctx.competitorProducts.length > 0) count += 1;
  return count;
}

export function confidenceCapForModuleCount(moduleCount: number): number {
  if (moduleCount <= 1) return 0.4;
  if (moduleCount === 2) return 0.55;
  if (moduleCount === 3) return 0.7;
  if (moduleCount === 4) return 0.85;
  return 0.95;
}

/**
 * Terapkan cap pada confidence LLM. Mengembalikan confidence final + flag
 * apakah cap aktif (untuk disclosure di reason).
 */
export function applyDataConfidenceCap(
  llmConfidence: number,
  ctx: UspGatheredContext,
): { confidence: number; capped: boolean; moduleCount: number } {
  const moduleCount = countContextModulesWithData(ctx);
  const cap = confidenceCapForModuleCount(moduleCount);
  const capped = llmConfidence > cap;
  return {
    confidence: capped ? cap : llmConfidence,
    capped,
    moduleCount,
  };
}
