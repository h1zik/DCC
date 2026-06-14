export function buildReviewBatchPrompt(
  productName: string,
  reviews: { idx: number; text: string; rating: number | null }[],
): string {
  const payload = reviews.map((r) => ({
    idx: r.idx,
    text: r.text.slice(0, 500),
    rating: r.rating,
  }));

  return `Kamu adalah analis riset pasar kosmetik & bodycare Indonesia.
Analisis batch review produk kompetitor "${productName}".

Untuk SETIAP review, tentukan:
- sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE"
- complaintThemes: array string tema keluhan (kosong jika tidak ada keluhan)
- praiseThemes: array string tema pujian (kosong jika tidak ada pujian)
- keywords: 2-5 kata kunci penting dari review
- complaintSeverity: angka 1-5 keparahan keluhan (1 ringan, 5 parah/berbahaya). null jika bukan keluhan.
- demographicHints: { "ageBand": "remaja"|"20an"|"30an"|"40plus"|null, "skinType": "berminyak"|"kering"|"kombinasi"|"sensitif"|"berjerawat"|null, "gender": "wanita"|"pria"|null } — INFERENSI dari teks, isi null bila tak ada petunjuk. JANGAN mengarang.
- pricePerception: "overpriced" | "worth_it" | "cheap" | null (persepsi nilai vs harga)
- repeatPurchaseSignal: true jika mengindikasikan beli ulang/langganan, selain itu false

PENTING: field "idx" HARUS sama persis dengan idx di input — jangan ubah urutan atau nilai idx. Inferensi demografi adalah PERKIRAAN, gunakan null bila ragu.

Balas HANYA JSON valid dengan bentuk:
{
  "reviews": [
    {
      "idx": 0,
      "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
      "complaintThemes": ["string"],
      "praiseThemes": ["string"],
      "keywords": ["string"],
      "complaintSeverity": 1,
      "demographicHints": { "ageBand": null, "skinType": null, "gender": null },
      "pricePerception": null,
      "repeatPurchaseSignal": false
    }
  ]
}

Data review:
${JSON.stringify(payload)}`;
}

import { buildActionPlanInstruction } from "@/lib/research/prescriptive/prompt";

/**
 * Structured prescriptive prompt for Review Intelligence. Replaces the old
 * single free-text "gap opportunity" paragraph with both a short gap summary
 * AND a department-scoped action plan.
 */
export function buildReviewActionPlanPrompt(input: {
  productName: string;
  competitorBrand: string;
  topComplaints: { theme: string; count: number }[];
  topPraises: { theme: string; count: number }[];
  severityByTheme: { theme: string; avgSeverity: number; count: number }[];
  demographics: { skinTypes: string[]; ageBands: string[] };
  positivePct: number;
  negativePct: number;
}): string {
  return `Kamu adalah strateg produk kosmetik & bodycare Indonesia.
Berdasarkan analisis review kompetitor di bawah, hasilkan insight + rencana aksi.

Produk kompetitor: ${input.productName}
Brand: ${input.competitorBrand}
Sentimen positif: ${input.positivePct.toFixed(1)}% · negatif: ${input.negativePct.toFixed(1)}%
Top keluhan: ${input.topComplaints.map((c) => `${c.theme} (${c.count})`).join(", ") || "—"}
Keluhan paling parah: ${input.severityByTheme.map((s) => `${s.theme} (severity ${s.avgSeverity.toFixed(1)}, ${s.count}x)`).join(", ") || "—"}
Top pujian: ${input.topPraises.map((p) => `${p.theme} (${p.count})`).join(", ") || "—"}
Demografi terdeteksi: skin type ${input.demographics.skinTypes.join(", ") || "—"}; umur ${input.demographics.ageBands.join(", ") || "—"}

1. "gapOpportunity": SATU paragraf (2-3 kalimat) peluang produk yang belum terpenuhi.

${buildActionPlanInstruction(["RND", "MARKETING", "PRICING"])}

Balas HANYA JSON valid:
{
  "gapOpportunity": "string",
  "actionPlan": { "headline": "string", "recommendations": [ /* sesuai skema di atas */ ] }
}`;
}
