import type { SemanticTerm } from "@/lib/seo/content/term-analysis";

/**
 * Perencanaan penulisan draft: bagi outline jadi section dengan budget kata dan
 * alokasi term semantik. Pure agar mudah di-test.
 */

export type PlannedSection = {
  id: string;
  /** null = paragraf pembuka (tanpa heading). */
  heading: string | null;
  points: string[];
  /** Term semantik yang wajib dipakai natural di section ini. */
  terms: string[];
  wordBudget: number;
  /** HTML hasil tulisan (diisi pipeline; resumable). */
  html?: string;
  done?: boolean;
};

export type OutlineSection = { heading: string; points: string[] };

/** Porsi budget kata. */
const OPENING_RATIO = 0.1;
const FAQ_RATIO = 0.15;
const DEFAULT_TARGET_WORDS = 1500;

/**
 * Susun rencana section: pembuka (10%) + section outline (sisa budget merata).
 * FAQ TIDAK direncanakan di sini (ditulis terpisah dari PAA) tapi budget-nya
 * disisihkan bila `hasFaq`.
 */
export function planDraftSections(
  outline: OutlineSection[],
  terms: SemanticTerm[],
  targetWordCount: number | null,
  opts: { hasFaq?: boolean } = {},
): PlannedSection[] {
  const total = targetWordCount ?? DEFAULT_TARGET_WORDS;
  const openingBudget = Math.round(total * OPENING_RATIO);
  const faqBudget = opts.hasFaq ? Math.round(total * FAQ_RATIO) : 0;

  // Outline yang memuat seksi FAQ dari brief dilewati — FAQ ditulis khusus dari PAA.
  const sections = outline.filter(
    (s) => !/^(faq|pertanyaan)/i.test(s.heading.trim()),
  );

  const bodySections = sections.length > 0 ? sections : [
    { heading: "Pembahasan", points: [] },
  ];
  const bodyBudget = Math.max(
    200,
    Math.round((total - openingBudget - faqBudget) / bodySections.length),
  );

  const planned: PlannedSection[] = [
    {
      id: "opening",
      heading: null,
      points: ["Paragraf pembuka yang memuat keyword target secara natural."],
      terms: [],
      wordBudget: openingBudget,
    },
    ...bodySections.map((s, i) => ({
      id: `s${i + 1}`,
      heading: s.heading,
      points: s.points,
      terms: [] as string[],
      wordBudget: bodyBudget,
    })),
  ];

  return assignTermsToSections(planned, terms);
}

/**
 * Alokasikan term ke section body secara round-robin berbobot importance
 * (term terpenting dibagi ke section awal dulu). Section pembuka tidak diberi
 * term (fokus keyword target).
 */
export function assignTermsToSections(
  sections: PlannedSection[],
  terms: SemanticTerm[],
): PlannedSection[] {
  const body = sections.filter((s) => s.heading !== null);
  if (body.length === 0 || terms.length === 0) return sections;

  const sorted = [...terms].sort((a, b) => b.importance - a.importance);
  const byId = new Map(sections.map((s) => [s.id, { ...s, terms: [...s.terms] }]));
  sorted.forEach((term, i) => {
    const target = body[i % body.length];
    byId.get(target.id)?.terms.push(term.term);
  });
  return sections.map((s) => byId.get(s.id) ?? s);
}

/**
 * Pecah HTML hasil satu call LLM ke masing-masing section berdasarkan <h2>.
 * Konten sebelum <h2> pertama menjadi milik section pertama batch (pembuka).
 */
export function splitBatchHtml(
  html: string,
  batch: { id: string; heading: string | null }[],
): { id: string; html: string }[] {
  if (batch.length === 1) return [{ id: batch[0].id, html }];

  const parts = html.split(/(?=<h2[\s>])/i).filter((p) => p.trim());
  const out: { id: string; html: string }[] = [];

  let partIdx = 0;
  for (let i = 0; i < batch.length; i++) {
    const section = batch[i];
    if (partIdx >= parts.length) {
      out.push({ id: section.id, html: "" });
      continue;
    }
    if (section.heading === null) {
      // Ambil bagian non-h2 pertama untuk pembuka.
      const isPlain = !/^<h2[\s>]/i.test(parts[partIdx].trim());
      out.push({ id: section.id, html: isPlain ? parts[partIdx].trim() : "" });
      if (isPlain) partIdx++;
      continue;
    }
    // Section terakhir menerima seluruh sisa parts (termasuk h3/h2 ekstra).
    if (i === batch.length - 1) {
      out.push({ id: section.id, html: parts.slice(partIdx).join("\n").trim() });
      partIdx = parts.length;
    } else {
      out.push({ id: section.id, html: parts[partIdx].trim() });
      partIdx++;
    }
  }
  return out;
}

/** Ambil ~N kata terakhir dari HTML (untuk kontinuitas antar chunk LLM). */
export function tailWords(html: string, n = 150): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(/\s+/);
  return words.slice(Math.max(0, words.length - n)).join(" ");
}
