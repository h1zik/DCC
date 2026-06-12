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

PENTING: field "idx" HARUS sama persis dengan idx di input — jangan ubah urutan atau nilai idx.

Balas HANYA JSON valid dengan bentuk:
{
  "reviews": [
    {
      "idx": 0,
      "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
      "complaintThemes": ["string"],
      "praiseThemes": ["string"],
      "keywords": ["string"]
    }
  ]
}

Data review:
${JSON.stringify(payload)}`;
}

export function buildGapOpportunityPrompt(input: {
  productName: string;
  competitorBrand: string;
  topComplaints: { theme: string; count: number }[];
  topPraises: { theme: string; count: number }[];
  positivePct: number;
  negativePct: number;
}): string {
  return `Kamu adalah strateg produk kosmetik Indonesia.
Berdasarkan analisis review kompetitor, tulis SATU paragraf (2-3 kalimat) "Gap Opportunity" —
peluang produk yang belum terpenuhi di pasar.

Produk: ${input.productName}
Brand kompetitor: ${input.competitorBrand}
Sentimen positif: ${input.positivePct.toFixed(1)}%
Sentimen negatif: ${input.negativePct.toFixed(1)}%
Top keluhan: ${input.topComplaints.map((c) => `${c.theme} (${c.count})`).join(", ")}
Top pujian: ${input.topPraises.map((p) => `${p.theme} (${p.count})`).join(", ")}

Tulis dalam Bahasa Indonesia, fokus pada insight actionable untuk product development.
Balas HANYA teks paragraf, tanpa judul atau markdown.`;
}
