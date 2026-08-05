/**
 * Pemindaian risiko asosiasi merek dari caption post.
 *
 * Engagement bagus tidak ada artinya kalau influencer-nya rutin
 * mempromosikan judi online: begitu brand memasang produk di sana, brand ikut
 * berdiri di samping konten itu. Untuk keputusan rekrutmen, risiko ini lebih
 * menentukan daripada selisih ER satu-dua persen.
 *
 * BATASNYA JELAS: ini pencocokan kata pada caption, bukan pemahaman konteks.
 * Hasilnya adalah DAFTAR PERIKSA — post yang cocok harus dibuka manual sebelum
 * disimpulkan. Karena itu tidak ada satu pun kategori yang memotong skor
 * secara otomatis; yang tertinggi hanya menahan vonis di "perlu dicek".
 */

export type BrandSafetyCategory =
  | "JUDI"
  | "PINJOL"
  | "INVESTASI"
  | "KLAIM_KESEHATAN"
  | "DEWASA"
  | "ALKOHOL_TEMBAKAU"
  | "POLITIK";

export type BrandSafetySeverity = "high" | "medium" | "low";

export type BrandSafetyHit = {
  category: BrandSafetyCategory;
  severity: BrandSafetySeverity;
  label: string;
  /** Mengapa kategori ini penting bagi brand. */
  why: string;
  /** Kata/frasa yang benar-benar cocok — supaya temuan bisa diverifikasi. */
  terms: string[];
  postCount: number;
  /** Hari sejak post terbaru di kategori ini. Null bila post tak bertanggal. */
  daysSinceLatest: number | null;
  /** Sampai 3 tautan post untuk diperiksa manual. */
  sampleUrls: string[];
};

export type BrandSafetyResult = {
  scannedPosts: number;
  hits: BrandSafetyHit[];
  worstSeverity: BrandSafetySeverity | null;
};

type CategorySpec = {
  category: BrandSafetyCategory;
  severity: BrandSafetySeverity;
  label: string;
  why: string;
  /**
   * Frasa (mengandung spasi) dicocokkan apa adanya; kata tunggal dicocokkan
   * utuh dengan batas kata supaya "slot" tidak ikut menangkap "slotted".
   */
  terms: string[];
  /**
   * Cocokkan juga pada teks yang sudah dinormalisasi dari angka-huruf
   * ("sl0t g4c0r"). Hanya untuk kategori yang istilahnya khas, karena
   * normalisasi ini bisa mengubah kata biasa.
   */
  deleet?: boolean;
};

const CATEGORIES: CategorySpec[] = [
  {
    category: "JUDI",
    severity: "high",
    label: "Promosi judi online",
    why: "Ilegal di Indonesia dan paling cepat menyeret brand ke krisis reputasi. Satu post pun sudah cukup jadi alasan membatalkan.",
    deleet: true,
    terms: [
      "judi online",
      "judol",
      "slot gacor",
      "situs slot",
      "link slot",
      "slot online",
      "akun slot",
      "bocoran slot",
      "pola slot",
      "maxwin",
      "max win",
      "scatter hitam",
      "rtp slot",
      "rtp live",
      "situs gacor",
      "gates of olympus",
      "mahjong ways",
      "depo receh",
      "deposit pulsa tanpa potongan",
      "wd cepat",
      "withdraw cepat",
      "anti rungkad",
      "jackpot besar",
      "bandar togel",
      "togel online",
      "casino online",
      "kasino online",
      "taruhan bola",
      "judi bola",
      "sabung ayam",
    ],
  },
  {
    category: "DEWASA",
    severity: "high",
    label: "Konten dewasa / layanan seksual",
    why: "Melanggar kebijakan iklan hampir semua platform dan tidak bisa dipakai brand konsumen.",
    terms: [
      "open bo",
      "openbo",
      "bo real",
      "jasa bo",
      "sewa teman kencan",
      "video bokep",
      "link bokep",
      "situs bokep",
      "vcs murah",
      "obat kuat pria",
      "alat bantu dewasa",
      "onlyfans",
    ],
  },
  {
    category: "PINJOL",
    severity: "medium",
    label: "Pinjaman online / gadai cepat",
    why: "Banyak yang tidak berizin OJK. Brand yang muncul berdampingan ikut menanggung kemarahan korbannya.",
    terms: [
      "pinjol",
      "pinjaman online",
      "pinjaman cepat cair",
      "pinjaman tanpa jaminan",
      "pinjaman tanpa bi checking",
      "dana cepat cair",
      "cair dalam hitungan menit",
      "gadai cepat",
      "tanpa slip gaji",
      "limit besar tanpa survey",
    ],
  },
  {
    category: "INVESTASI",
    severity: "medium",
    label: "Investasi & trading berisiko",
    why: "Skema robot trading dan 'profit pasti' rutin berakhir jadi kasus penipuan. Konten lama pun tetap terkait ke nama brand.",
    terms: [
      "robot trading",
      "binary option",
      "binomo",
      "quotex",
      "olymp trade",
      "profit konsisten",
      "profit pasti",
      "cuan pasti",
      "auto cuan",
      "titip dana",
      "bagi hasil tetap",
      "money game",
      "skema ponzi",
      "airdrop gratis",
      "pump coin",
    ],
  },
  {
    category: "KLAIM_KESEHATAN",
    severity: "medium",
    label: "Klaim kesehatan berlebihan",
    why: "Klaim seperti 'dijamin sembuh' melanggar aturan BPOM. Brand yang beriklan di akun yang sama ikut disorot.",
    terms: [
      "dijamin sembuh",
      "sembuh total tanpa obat",
      "tanpa efek samping sama sekali",
      "pelangsing instan",
      "turun 10 kg seminggu",
      "pemutih instan",
      "obat herbal segala penyakit",
      "menyembuhkan segala penyakit",
      "tanpa bpom",
      "suntik putih",
      "sedot lemak murah",
    ],
  },
  {
    category: "ALKOHOL_TEMBAKAU",
    severity: "low",
    label: "Alkohol, rokok, atau vape",
    why: "Bukan pelanggaran, tapi membatasi kampanye keluarga dan iklan berbayar di sebagian platform.",
    terms: [
      "vape",
      "vapor",
      "liquid vape",
      "pod vape",
      "rokok elektrik",
      "minuman keras",
      "miras",
      "soju",
      "vodka",
      "whisky",
      "wiski",
      "bir dingin",
    ],
  },
  {
    category: "POLITIK",
    severity: "low",
    label: "Kampanye politik",
    why: "Bukan masalah keamanan, tapi memihak: separuh audiens brand bisa membacanya sebagai dukungan.",
    terms: [
      "capres",
      "cawapres",
      "pilpres",
      "pilkada",
      "coblos nomor",
      "menangkan nomor",
      "partai politik",
      "kampanye akbar",
      "dukung paslon",
    ],
  },
];

const CATEGORY_LABEL: Record<BrandSafetyCategory, string> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.category]: c.label }),
  {} as Record<BrandSafetyCategory, string>,
);

export function brandSafetyCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category as BrandSafetyCategory] ?? category;
}

const SEVERITY_RANK: Record<BrandSafetySeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Kembalikan angka yang menyamar jadi huruf: "sl0t g4c0r" → "slot gacor". */
function deleet(text: string): string {
  return text
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/\$/g, "s");
}

/**
 * Caption disederhanakan dulu: huruf kecil, tanda baca dan emoji jadi spasi.
 * Tanpa ini "#slotgacor" dan "slot•gacor" lolos dari pencocokan frasa.
 */
function normalizeCaption(caption: string): string {
  return caption
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s$]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hashtag digabung tanpa spasi ("#slotgacor"), jadi dipecah terpisah. */
function hashtagWords(caption: string): string {
  const tags = caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return tags
    .map((tag) =>
      tag
        .slice(1)
        .replace(/_/g, " ")
        // camelCase → kata terpisah, lalu sisipkan spasi tiap batas huruf-angka.
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase(),
    )
    .join(" ");
}

function matchTerms(spec: CategorySpec, haystacks: string[]): string[] {
  const found = new Set<string>();

  for (const term of spec.terms) {
    const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:$|\\s)`, "u");
    // Frasa juga dicari tanpa spasi supaya "#slotgacor" tertangkap.
    const glued = term.includes(" ")
      ? new RegExp(`(?:^|\\s)${escapeRegExp(term.replace(/\s+/g, ""))}(?:$|\\s)`, "u")
      : null;

    for (const hay of haystacks) {
      if (pattern.test(hay) || glued?.test(hay)) {
        found.add(term);
        break;
      }
    }
  }

  return [...found];
}

export type BrandSafetyScanPost = {
  caption?: string | null;
  url?: string | null;
  postedAt?: Date | null;
};

/**
 * Pindai seluruh post yang diambil — bukan hanya yang masuk sampel penilaian.
 * Post judi delapan bulan lalu tetap ada di profil dan tetap jadi risiko
 * asosiasi, meski sudah di luar jendela pengukuran engagement.
 */
export function scanBrandSafety(
  posts: BrandSafetyScanPost[],
  now: Date = new Date(),
): BrandSafetyResult {
  const perCategory = new Map<
    BrandSafetyCategory,
    { spec: CategorySpec; terms: Set<string>; urls: string[]; count: number; latest: number | null }
  >();

  for (const post of posts) {
    if (!post.caption) continue;

    const base = normalizeCaption(post.caption);
    const tags = normalizeCaption(hashtagWords(post.caption));
    const plain = [base, tags].filter(Boolean);
    const leet = plain.map(deleet);

    for (const spec of CATEGORIES) {
      const terms = matchTerms(spec, spec.deleet ? [...plain, ...leet] : plain);
      if (terms.length === 0) continue;

      const entry =
        perCategory.get(spec.category) ??
        { spec, terms: new Set<string>(), urls: [], count: 0, latest: null };

      for (const t of terms) entry.terms.add(t);
      entry.count += 1;
      if (post.url && entry.urls.length < 3) entry.urls.push(post.url);
      const ts = post.postedAt?.getTime() ?? null;
      if (ts !== null && (entry.latest === null || ts > entry.latest)) {
        entry.latest = ts;
      }

      perCategory.set(spec.category, entry);
    }
  }

  const hits: BrandSafetyHit[] = [...perCategory.values()]
    .map((entry) => ({
      category: entry.spec.category,
      severity: entry.spec.severity,
      label: entry.spec.label,
      why: entry.spec.why,
      terms: [...entry.terms].sort(),
      postCount: entry.count,
      daysSinceLatest:
        entry.latest === null
          ? null
          : Math.max(Math.floor((now.getTime() - entry.latest) / 86_400_000), 0),
      sampleUrls: entry.urls,
    }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        b.postCount - a.postCount,
    );

  return {
    scannedPosts: posts.length,
    hits,
    worstSeverity: hits[0]?.severity ?? null,
  };
}
