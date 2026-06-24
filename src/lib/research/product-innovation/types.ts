/** 6 lensa SCAMPER sesuai scope fitur (tanpa Modify). */
export const SCAMPER_TECHNIQUES = [
  {
    key: "SUBSTITUTE",
    label: "Substitute",
    labelId: "Substitusi",
    hint: "Ganti bahan, komponen, kemasan, atau proses dengan alternatif lain.",
  },
  {
    key: "COMBINE",
    label: "Combine",
    labelId: "Kombinasi",
    hint: "Gabungkan dua produk, fungsi, atau manfaat menjadi satu.",
  },
  {
    key: "ADAPT",
    label: "Adapt",
    labelId: "Adaptasi",
    hint: "Adaptasi ide dari kategori/konteks lain ke produk ini.",
  },
  {
    key: "PUT_TO_OTHER_USE",
    label: "Put to Other Use",
    labelId: "Guna Lain",
    hint: "Temukan penggunaan atau segmen baru untuk produk ini.",
  },
  {
    key: "ELIMINATE",
    label: "Eliminate",
    labelId: "Eliminasi",
    hint: "Hilangkan bahan, langkah, atau fitur yang tidak perlu (simplifikasi).",
  },
  {
    key: "REVERSE_REARRANGE",
    label: "Reverse / Rearrange",
    labelId: "Balik / Susun Ulang",
    hint: "Balik urutan, format, atau susun ulang elemen produk.",
  },
] as const;

export type ScamperTechniqueKey = (typeof SCAMPER_TECHNIQUES)[number]["key"];

export const SCAMPER_TECHNIQUE_KEYS = SCAMPER_TECHNIQUES.map(
  (t) => t.key,
) as ScamperTechniqueKey[];

export function scamperTechniqueMeta(key: string) {
  return SCAMPER_TECHNIQUES.find((t) => t.key === key) ?? null;
}

export type ScamperIdea = {
  /** cuid yang di-assign di server saat menyimpan. */
  id: string;
  technique: ScamperTechniqueKey;
  title: string;
  description: string;
  /** Alasan berbasis evidence (kenapa ini relevan untuk pasar). */
  rationale: string;
  /** Perubahan konkret dari produk basis. */
  change: string;
  /** Manfaat utama bagi konsumen. */
  benefit: string;
  /** Catatan kelayakan/eksekusi singkat. */
  feasibilityNote?: string;
  /** Diisi setelah dipromosikan ke Concept Lab. */
  promotedConceptId?: string | null;
};

/** Bentuk mentah dari LLM (tanpa id/promotedConceptId). */
export type ScamperIdeaDraft = Omit<ScamperIdea, "id" | "promotedConceptId">;

export type ScamperResult = {
  ideas: ScamperIdeaDraft[];
  aiSummary?: string;
};

export function parseScamperIdeas(raw: unknown): ScamperIdea[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x != null)
    .map((o) => ({
      id: typeof o.id === "string" ? o.id : "",
      technique: (SCAMPER_TECHNIQUE_KEYS.includes(o.technique as ScamperTechniqueKey)
        ? o.technique
        : "SUBSTITUTE") as ScamperTechniqueKey,
      title: typeof o.title === "string" ? o.title : "",
      description: typeof o.description === "string" ? o.description : "",
      rationale: typeof o.rationale === "string" ? o.rationale : "",
      change: typeof o.change === "string" ? o.change : "",
      benefit: typeof o.benefit === "string" ? o.benefit : "",
      feasibilityNote:
        typeof o.feasibilityNote === "string" ? o.feasibilityNote : undefined,
      promotedConceptId:
        typeof o.promotedConceptId === "string" ? o.promotedConceptId : null,
    }))
    .filter((idea) => idea.title.length > 0);
}
