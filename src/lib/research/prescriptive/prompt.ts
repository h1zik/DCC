import type { RecOwner } from "./types";
import { buildBrandGuardInstruction } from "@/lib/research/brand-guard";

const OWNER_GUIDE: Record<RecOwner, string> = {  MARKETING: "kampanye, angle konten, channel, copy/positioning di listing & sosial",
  RND: "formulasi, bahan aktif, tekstur, klaim yang perlu dibuktikan, kemasan",
  PRICING: "rentang harga, bundling, diskon, posisi harga vs kompetitor",
  FINANCE: "margin, target COGS, alokasi budget, skenario harga",
  SUPPLY: "sourcing bahan, kapasitas produksi, lead time, kemasan",
  BRAND: "positioning, tone of voice, segmentasi, narasi diferensiasi",
};

/**
 * Returns a standardized JSON sub-schema instruction that is appended to EVERY
 * module's analysis prompt so all analyzers emit the same `actionPlan` block.
 *
 * Pass the owners that are most relevant to the calling module to bias the
 * model toward the right departments (it may still use others when justified).
 */
export function buildActionPlanInstruction(
  preferredOwners?: RecOwner[],
  forbiddenBrands?: string[],
): string {  const owners = (preferredOwners ?? [
    "MARKETING",
    "RND",
    "PRICING",
    "FINANCE",
    "BRAND",
  ]) as RecOwner[];

  const ownerLines = owners
    .map((o) => `- ${o}: ${OWNER_GUIDE[o]}`)
    .join("\n");

  return `
TUGAS PRESKRIPTIF (WAJIB): Selain insight di atas, hasilkan "actionPlan" — rencana aksi konkret "apa yang harus dilakukan selanjutnya". JANGAN hanya merangkum data.

Aturan untuk setiap rekomendasi:
- "action" HARUS kalimat perintah operasional (mulai dengan kata kerja), spesifik & bisa langsung dikerjakan.
- "owner" pilih departemen paling relevan:
${ownerLines}
- "priority": "P0" (mendesak/berdampak besar), "P1" (penting), "P2" (nice-to-have).
- "evidence": WAJIB mengacu ke data input di atas. Setiap evidence cantumkan "module" (mis. "review-intelligence", "competitor-tracker", "trend-radar", "keyword-intel", "social-listening") dan "label" (kutipan/angka dari data). JANGAN mengarang bukti yang tidak ada di input.
- "confidence": 0..1 sesuai kekuatan bukti.
- "effort": "LOW" | "MED" | "HIGH". "horizon": "NOW" | "30D" | "QUARTER".
- "expectedImpact": dampak bisnis bila dieksekusi. "metricToWatch": KPI yang dipantau.
- Buat 3-6 rekomendasi, urut dari paling berdampak. Hindari rekomendasi generik.

Sertakan field "actionPlan" pada JSON balasan dengan bentuk PERSIS:
"actionPlan": {
  "headline": "string (1 kalimat keputusan utama)",
  "recommendations": [
    {
      "owner": "MARKETING|RND|PRICING|FINANCE|SUPPLY|BRAND",
      "priority": "P0|P1|P2",
      "action": "string",
      "rationale": "string",
      "evidence": [{ "module": "string", "label": "string" }],
      "expectedImpact": "string",
      "metricToWatch": "string",
      "confidence": number,
      "effort": "LOW|MED|HIGH",
      "horizon": "NOW|30D|QUARTER"
    }
  ]
}

Contoh satu rekomendasi yang baik (jangan disalin, sesuaikan dengan data nyata):
{ "owner": "RND", "priority": "P0", "action": "Reformulasi base agar cepat meresap & tidak lengket", "rationale": "Keluhan 'lengket' adalah tema negatif teratas (24x).", "evidence": [{ "module": "review-intelligence", "label": "Keluhan tekstur lengket 24x" }], "expectedImpact": "Menurunkan keluhan tekstur, menaikkan repeat purchase", "metricToWatch": "% review negatif tekstur", "confidence": 0.8, "effort": "MED", "horizon": "QUARTER" }
${forbiddenBrands && forbiddenBrands.length > 0 ? `\n\n${buildBrandGuardInstruction({ forbiddenBrands })}` : ""}`.trim();
}
