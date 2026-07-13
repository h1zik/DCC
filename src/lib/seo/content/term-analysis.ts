/**
 * Analisis term semantik ala Surfer/Semrush dari konten kompetitor top SERP.
 * Pure TS (tanpa dependensi berat/stemmer): tokenisasi + stopword Indonesia,
 * n-gram (uni/bi/trigram), lalu skor importance gabungan doc-frequency dan
 * rata-rata kemunculan. Output daftar term dengan target range pemakaian.
 */

export type SemanticTerm = {
  term: string;
  /** Berapa dokumen kompetitor yang memuat term ini. */
  docCount: number;
  /** Rata-rata kemunculan pada dokumen yang memuatnya. */
  avgCount: number;
  /** Skor prioritas 0..~1+ (untuk sorting & bobot skoring konten). */
  importance: number;
  /** Target pemakaian minimal/maksimal di artikel sendiri. */
  targetMin: number;
  targetMax: number;
};

/** Stopword Indonesia + filler Inggris umum di konten beauty. */
const STOPWORDS = new Set([
  // fungsi umum
  "yang", "dan", "untuk", "dengan", "dari", "ini", "itu", "adalah", "pada",
  "ke", "di", "juga", "bisa", "akan", "atau", "karena", "agar", "saat",
  "dalam", "tidak", "sudah", "ada", "jika", "kamu", "anda", "kami", "kita",
  "mereka", "dia", "ia", "nya", "para", "oleh", "serta", "yaitu", "yakni",
  "sebagai", "secara", "tersebut", "namun", "tetapi", "tapi", "hanya",
  "lebih", "sangat", "paling", "banyak", "sedikit", "semua", "setiap",
  "masih", "telah", "dapat", "harus", "perlu", "boleh", "jangan", "belum",
  "seperti", "hingga", "sampai", "antara", "tanpa", "bila", "apabila",
  "ketika", "sebelum", "sesudah", "setelah", "selama", "sejak", "lalu",
  "kemudian", "maka", "sehingga", "bahwa", "pun", "per", "bagi", "terhadap",
  "melalui", "berdasarkan", "tentang", "menurut", "adanya", "menjadi",
  "membuat", "melakukan", "menggunakan", "digunakan", "merupakan",
  "terdapat", "memiliki", "punya", "salah", "satu", "dua", "tiga", "cara",
  "berikut", "yuk", "nih", "loh", "deh", "sih", "kok", "ya", "nah", "hai",
  "halo", "selain", "bahkan", "apakah", "kenapa", "mengapa", "bagaimana",
  "dimana", "kapan", "siapa", "apa", "mana", "begitu", "kalau", "kalo",
  "biar", "supaya", "gak", "nggak", "tak", "enggak", "aja", "saja", "kan",
  "dong", "banget", "juga", "lagi", "udah", "udahan", "baru", "lama",
  // filler EN
  "the", "and", "for", "with", "from", "this", "that", "your", "you", "are",
  "was", "were", "has", "have", "had", "not", "but", "can", "will", "our",
  "all", "any", "how", "what", "when", "where", "why", "who", "its", "it",
  "of", "in", "on", "at", "to", "a", "an", "is", "be", "or", "as", "by",
]);

/** Tokenisasi sederhana Bahasa Indonesia: lowercase, buang tanda baca/angka murni. */
export function tokenizeId(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ\s-]/gi, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t));
}

function isStopword(token: string): boolean {
  return STOPWORDS.has(token);
}

/** Bangun n-gram (1..3) dari token; n-gram tidak boleh diawali/diakhiri stopword. */
export function buildNgrams(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (term: string) => counts.set(term, (counts.get(term) ?? 0) + 1);

  for (let i = 0; i < tokens.length; i++) {
    const t1 = tokens[i];
    if (!isStopword(t1)) add(t1);
    if (i + 1 < tokens.length) {
      const t2 = tokens[i + 1];
      if (!isStopword(t1) && !isStopword(t2)) add(`${t1} ${t2}`);
      if (i + 2 < tokens.length) {
        const t3 = tokens[i + 2];
        // Trigram boleh memuat stopword di tengah ("serum untuk kulit").
        if (!isStopword(t1) && !isStopword(t3)) add(`${t1} ${t2} ${t3}`);
      }
    }
  }
  return counts;
}

export type TermAnalysisOptions = {
  /** Keyword target — term yang merupakan substring keyword dibuang. */
  targetKeyword?: string;
  /** Maksimal term yang dikembalikan. */
  limit?: number;
};

/**
 * Analisis term lintas dokumen kompetitor. `docs` = bodyText per kompetitor.
 */
export function analyzeTerms(
  docs: string[],
  opts: TermAnalysisOptions = {},
): SemanticTerm[] {
  const totalDocs = docs.length;
  if (totalDocs === 0) return [];
  const limit = opts.limit ?? 30;
  const kw = opts.targetKeyword?.toLowerCase().trim() ?? "";

  // Hitung per-dokumen.
  const perDoc = docs.map((doc) => buildNgrams(tokenizeId(doc)));

  // Agregasi: docCount + total kemunculan pada dokumen yang memuatnya.
  const docCount = new Map<string, number>();
  const totalCount = new Map<string, number>();
  for (const counts of perDoc) {
    for (const [term, count] of counts) {
      docCount.set(term, (docCount.get(term) ?? 0) + 1);
      totalCount.set(term, (totalCount.get(term) ?? 0) + count);
    }
  }

  const minDocs = Math.max(2, Math.ceil(0.3 * totalDocs));
  const candidates: SemanticTerm[] = [];
  for (const [term, dc] of docCount) {
    if (dc < minDocs && totalDocs > 1) continue;
    if (kw && (kw.includes(term) || term === kw)) continue;
    const avg = (totalCount.get(term) ?? 0) / dc;
    const importance = (dc / totalDocs) * Math.log(1 + avg);
    candidates.push({
      term,
      docCount: dc,
      avgCount: Math.round(avg * 10) / 10,
      importance: Math.round(importance * 1000) / 1000,
      targetMin: Math.max(1, Math.floor(avg * 0.5)),
      targetMax: Math.max(1, Math.ceil(avg * 1.5)),
    });
  }

  candidates.sort((a, b) => b.importance - a.importance);

  // Buang unigram yang sudah tercakup n-gram lebih panjang dengan skor sebanding.
  const kept: SemanticTerm[] = [];
  for (const cand of candidates) {
    const subsumed = kept.some(
      (k) =>
        k.term.length > cand.term.length &&
        k.term.split(" ").includes(cand.term),
    );
    if (!subsumed) kept.push(cand);
    if (kept.length >= limit) break;
  }
  return kept;
}

export type MedianTargets = {
  targetWordCount: number;
  targetHeadings: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Target artikel dari median kompetitor (+10% agar sedikit lebih komprehensif). */
export function medianTargets(
  competitors: { wordCount: number; headingsCount: number }[],
): MedianTargets {
  const words = competitors.map((c) => c.wordCount).filter((n) => n > 0);
  const headings = competitors.map((c) => c.headingsCount);
  const targetWordCount = Math.min(
    3000,
    Math.max(1200, Math.round(median(words) * 1.1)),
  );
  const targetHeadings = Math.max(3, Math.round(median(headings)));
  return { targetWordCount, targetHeadings };
}
