import type { InfluencerPlatform } from "@prisma/client";

/**
 * Niche kreator — filter utama halaman peringkat.
 *
 * Disimpan sebagai String di database, bukan enum Prisma, karena daftar ini
 * akan berubah jauh lebih sering daripada yang pantas dibayar dengan migrasi
 * skema tiap kalinya. Validasinya ada di sini.
 *
 * Condong ke beauty & perawatan diri karena itu medan DCC, tapi tetap memuat
 * niche bertetangga: seorang kreator parenting atau kuliner sering justru
 * pilihan yang lebih tepat untuk produk tertentu.
 */
export const CREATOR_CATEGORIES = [
  "beauty-skincare",
  "beauty-makeup",
  "haircare",
  "body-personal-care",
  "fashion",
  "food-beverage",
  "health-fitness",
  "parenting-family",
  "lifestyle-daily",
  "travel",
  "home-living",
  "tech-gadget",
  "finance-business",
  "education",
  "entertainment-comedy",
  "gaming",
  "automotive",
  /** Kreator yang isinya tidak jatuh ke mana pun — BUKAN keranjang tebakan. */
  "other",
] as const;

export type CreatorCategory = (typeof CREATOR_CATEGORIES)[number];

export const CREATOR_CATEGORY_LABEL: Record<CreatorCategory, string> = {
  "beauty-skincare": "Skincare",
  "beauty-makeup": "Makeup",
  haircare: "Perawatan Rambut",
  "body-personal-care": "Perawatan Tubuh",
  fashion: "Fashion",
  "food-beverage": "Makanan & Minuman",
  "health-fitness": "Kesehatan & Kebugaran",
  "parenting-family": "Parenting & Keluarga",
  "lifestyle-daily": "Lifestyle",
  travel: "Travel",
  "home-living": "Rumah & Interior",
  "tech-gadget": "Teknologi & Gadget",
  "finance-business": "Keuangan & Bisnis",
  education: "Edukasi",
  "entertainment-comedy": "Hiburan & Komedi",
  gaming: "Gaming",
  automotive: "Otomotif",
  other: "Lainnya",
};

const CATEGORY_SET = new Set<string>(CREATOR_CATEGORIES);

export function isCreatorCategory(value: unknown): value is CreatorCategory {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export function creatorCategoryLabel(value: string | null): string {
  return isCreatorCategory(value) ? CREATOR_CATEGORY_LABEL[value] : "Belum diklasifikasi";
}

/**
 * Di bawah ambang ini, kategori ditampilkan sebagai dugaan — bukan fakta.
 * Kreator dengan bio kosong dan satu hashtag memang tidak bisa dipastikan.
 */
export const CATEGORY_CONFIDENCE_TRUSTED = 0.6;

/** Klasifikasi diulang setelah sekian hari; bio dan arah konten orang berubah. */
export const CATEGORY_STALE_DAYS = 90;

/**
 * Berapa kreator dijejalkan ke satu panggilan LLM.
 *
 * Ini pengungkit biaya klasifikasi: satu panggilan berisi 20 orang kira-kira
 * dua puluh kali lebih murah daripada 20 panggilan berisi satu orang, dan
 * tugasnya cukup sederhana sehingga akurasinya tidak jatuh.
 */
export const CLASSIFY_BATCH_SIZE = 20;

export type ClassifiableCreator = {
  handle: string;
  platform: InfluencerPlatform;
  bio: string | null;
  /** Hashtag/kata kunci tempat mereka ditemukan — sinyal niche paling murah. */
  discoveryTerms: string[];
  /** Cuplikan caption dari post penemuannya. */
  captions: string[];
};

export type CreatorClassification = {
  handle: string;
  category: CreatorCategory;
  /** 0-1. */
  confidence: number;
  /** ISO 639-1, atau null bila tidak bisa ditentukan. */
  language: string | null;
};

/**
 * Kreator tanpa bio, tanpa hashtag penemu, dan tanpa caption tidak punya bahan
 * apa pun untuk diklasifikasi. Mengirimnya ke LLM hanya membeli tebakan dari
 * bentuk username — lebih baik dibiarkan kosong sampai datanya ada.
 */
export function hasClassifiableSignal(creator: ClassifiableCreator): boolean {
  return (
    !!creator.bio?.trim() ||
    creator.discoveryTerms.some((t) => t.trim()) ||
    creator.captions.some((c) => c.trim())
  );
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function buildClassificationPrompt(
  creators: ClassifiableCreator[],
): string {
  const list = creators
    .map((c, i) => {
      const lines = [
        `${i + 1}. handle: ${c.handle} (${c.platform === "INSTAGRAM" ? "Instagram" : "TikTok"})`,
        `   bio: ${c.bio ? truncate(c.bio, 300) : "(kosong)"}`,
      ];
      if (c.discoveryTerms.length > 0) {
        lines.push(
          `   ditemukan lewat: ${c.discoveryTerms.slice(0, 5).join(", ")}`,
        );
      }
      for (const caption of c.captions.slice(0, 3)) {
        const clean = truncate(caption, 200);
        if (clean) lines.push(`   caption: ${clean}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  return `Kamu adalah analis influencer marketing di Indonesia. Tentukan niche konten setiap kreator berikut.

PILIHAN KATEGORI (pakai persis salah satu kode ini, jangan mengarang kode baru):
${CREATOR_CATEGORIES.map((c) => `- ${c} = ${CREATOR_CATEGORY_LABEL[c]}`).join("\n")}

ATURAN:
- Pilih SATU kategori yang paling menggambarkan mayoritas kontennya, bukan satu post kebetulan.
- "ditemukan lewat" adalah hashtag tempat mereka tertangkap crawler. Itu petunjuk kuat, tapi bukan bukti: orang bisa ikut satu hashtag viral di luar niche-nya.
- Pakai "other" bila kontennya benar-benar tidak jatuh ke kategori mana pun. JANGAN memaksakan kategori yang paling mendekati.
- confidence adalah angka 0 sampai 1. Isi di bawah 0.5 bila kamu menebak. Bio kosong dengan satu hashtag TIDAK layak dapat confidence tinggi. Kejujuran di sini jauh lebih berguna daripada terlihat yakin.
- language adalah kode ISO 639-1 dua huruf untuk bahasa yang dominan dipakai ("id", "en", "jv", ...). Isi null bila tidak cukup teks untuk menentukan.

KREATOR:
${list}

Jawab HANYA JSON dengan bentuk persis:
{"results":[{"handle":"...","category":"...","confidence":0.0,"language":"id"}]}

Sertakan SEMUA ${creators.length} kreator di atas, dengan handle disalin persis seperti yang diberikan.`;
}

export type ParsedClassifications = {
  classifications: CreatorClassification[];
  warnings: string[];
};

function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}

/**
 * Terima "id", "ID", dan bentuk locale "id-ID"; tolak selebihnya.
 *
 * Sengaja TIDAK memotong dua huruf pertama dari sembarang teks — itu mengubah
 * "bahasa indonesia" menjadi kode "ba" yang tampak sah padahal karangan. Bahasa
 * yang tidak diketahui lebih berguna dibiarkan null.
 */
function normalizeLanguage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2}$/.test(code) ? code : null;
}

/**
 * Baca jawaban LLM dan cocokkan kembali ke kreator yang diminta.
 *
 * Kategori di luar taksonomi DIBUANG, tidak dipaksa jadi "other": "other"
 * adalah pernyataan bahwa kontennya memang tidak masuk kategori mana pun,
 * sedangkan kode yang dikarang model berarti jawabannya tidak terbaca. Yang
 * dibuang tetap tidak terklasifikasi dan akan dicoba lagi di putaran berikutnya
 * — jauh lebih baik daripada mengunci label yang salah.
 */
export function parseCreatorClassifications(
  raw: unknown,
  requested: ClassifiableCreator[],
): ParsedClassifications {
  const warnings: string[] = [];
  const byHandle = new Map(
    requested.map((c) => [c.handle.toLowerCase(), c.handle]),
  );

  const results =
    raw && typeof raw === "object" && Array.isArray((raw as { results?: unknown }).results)
      ? ((raw as { results: unknown[] }).results as unknown[])
      : null;

  if (!results) {
    return {
      classifications: [],
      warnings: ["Jawaban AI tidak memuat daftar hasil yang bisa dibaca."],
    };
  }

  const seen = new Set<string>();
  const classifications: CreatorClassification[] = [];

  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;

    const rawHandle =
      typeof row.handle === "string" ? row.handle.trim().toLowerCase() : "";
    const handle = byHandle.get(rawHandle);
    if (!handle) {
      if (rawHandle) {
        warnings.push(`AI mengembalikan handle "${rawHandle}" yang tidak diminta.`);
      }
      continue;
    }
    // Jawaban ganda untuk orang yang sama: yang pertama menang.
    if (seen.has(handle)) continue;

    if (!isCreatorCategory(row.category)) {
      warnings.push(
        `@${handle}: kategori "${String(row.category)}" di luar daftar — dilewati.`,
      );
      continue;
    }

    seen.add(handle);
    classifications.push({
      handle,
      category: row.category,
      confidence: clampConfidence(row.confidence),
      language: normalizeLanguage(row.language),
    });
  }

  const missing = requested.length - classifications.length;
  if (missing > 0) {
    warnings.push(
      `${missing} dari ${requested.length} kreator tidak terklasifikasi di putaran ini.`,
    );
  }

  return { classifications, warnings };
}
