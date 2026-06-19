import type { ClusteredTrend } from "@/lib/research/trend-radar/trend-signal-types";
import { buildActionPlanInstruction } from "@/lib/research/prescriptive/prompt";
import { buildBrandGuardInstruction } from "@/lib/research/brand-guard";

export function buildTrendActionPlanPrompt(input: {
  narrative: string;
  items: {
    name: string;
    dimension: string;
    phase: string;
    score: number;
  }[];
  forbiddenBrands?: string[];
}): string {
  return `Kamu adalah strateg produk beauty Indonesia.
Berdasarkan tren minggu ini, buat rencana aksi konkret.

Ringkasan: ${input.narrative}
Tren: ${input.items
    .map(
      (i) =>
        `${i.name} [${i.dimension}/${i.phase}, TMI ${i.score.toFixed(2)}]`,
    )
    .join("; ")}

Pedoman fase->aksi: EMERGING = eksplorasi/early bet R&D; GROWING = percepat masuk pasar & marketing; PEAK = diferensiasi/hindari me-too; DECLINING = hindari investasi baru / phase-out.

${buildBrandGuardInstruction({ forbiddenBrands: input.forbiddenBrands ?? [] })}

${buildActionPlanInstruction(["RND", "MARKETING", "BRAND"], input.forbiddenBrands)}

Balas HANYA JSON valid:
{ "actionPlan": { "headline": "string", "recommendations": [ /* skema di atas */ ] } }`;
}

/** Narrative-only — fase/TMI/evidence sudah dihitung deterministik. */
export function buildTrendNarrativePrompt(input: {
  trends: ClusteredTrend[];
  watchlistName?: string;
  seedKeywords?: string[];
  forbiddenBrands?: string[];
  digestMode: string;
}): string {
  const payload = input.trends.map((t) => ({
    name: t.name,
    dimension: t.dimension,
    phase: t.phase,
    tmiScore: t.tmiScore,
    confidence: t.confidence,
    isGlobalPipeline: t.isGlobalPipeline,
    evidenceCount: t.evidence.length,
    evidence: t.evidence.slice(0, 6),
  }));

  return `Kamu adalah analis tren kosmetik & beauty Indonesia.
${input.watchlistName ? `Watchlist: "${input.watchlistName}"` : "Digest tren global mingguan."}
${input.seedKeywords?.length ? `Seed keywords: ${input.seedKeywords.join(", ")}` : ""}
Mode digest: ${input.digestMode}

${buildBrandGuardInstruction({ forbiddenBrands: input.forbiddenBrands ?? [] })}

Tren sudah dikluster dan discore secara deterministik — JANGAN ubah fase, TMI, atau tambah sumber baru.
Hanya tulis:
1. narrative ringkasan mingguan (3-4 kalimat Bahasa Indonesia) berdasarkan tren di bawah
2. narrative per tren (1-2 kalimat) dan relatedProducts generik (tanpa nama brand kompetitor)

Data tren terverifikasi:
${JSON.stringify(payload)}

Balas HANYA JSON:
{
  "narrative": "string",
  "items": [{
    "name": "string (harus sama persis dengan input)",
    "narrative": "string",
    "relatedProducts": ["string"]
  }]
}`;
}

/** @deprecated Pipeline baru memakai buildTrendNarrativePrompt */
export function buildTrendAnalysisPrompt(input: {
  signals: { term: string; source: string; meta?: Record<string, unknown> }[];
  watchlistName?: string;
  seedKeywords?: string[];
  forbiddenBrands?: string[];
}): string {
  return buildTrendNarrativePrompt({
    trends: [],
    watchlistName: input.watchlistName,
    seedKeywords: input.seedKeywords,
    forbiddenBrands: input.forbiddenBrands,
    digestMode: "legacy",
  });
}
