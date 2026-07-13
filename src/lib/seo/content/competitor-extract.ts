import * as cheerio from "cheerio";

/**
 * Ekstraksi sinyal artikel dari HTML halaman kompetitor. Pure (input string,
 * tanpa fetch/server) agar mudah di-test. `bodyText` dipakai untuk analisis
 * term tapi TIDAK disimpan ke database.
 */

export type CompetitorHeading = {
  level: 2 | 3;
  text: string;
};

export type ArticleSignals = {
  title: string | null;
  metaDescription: string | null;
  wordCount: number;
  headings: CompetitorHeading[];
  /** Teks konten utama — hanya untuk analisis term, jangan dipersist. */
  bodyText: string;
};

const STRIP_SELECTORS =
  "script, style, noscript, nav, footer, header, aside, form, iframe, svg";

export function extractArticleSignals(html: string): ArticleSignals {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;

  $(STRIP_SELECTORS).remove();

  // Pilih kontainer konten utama: <article> / <main> / body.
  const article = $("article").first();
  const main = $("main").first();
  const container = article.length ? article : main.length ? main : $("body");

  // HTML minified menggabung teks antar-elemen tanpa spasi — sisipkan pemisah.
  container.find("p, h1, h2, h3, h4, h5, h6, li, td, div, section").after(" ");

  const bodyText = container.text().replace(/\s+/g, " ").trim();
  const words = bodyText ? bodyText.split(/\s+/) : [];

  const headings: CompetitorHeading[] = [];
  container.find("h2, h3").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    headings.push({ level: el.tagName?.toLowerCase() === "h3" ? 3 : 2, text });
  });

  return {
    title,
    metaDescription,
    wordCount: words.length,
    headings,
    bodyText,
  };
}
