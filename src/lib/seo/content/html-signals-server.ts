import * as cheerio from "cheerio";
import {
  buildDocSignals,
  extractVerifyMarkersFromHtml,
  type DocHeading,
  type DocSignals,
} from "@/lib/seo/content/html-signals";

/** Extractor server (cheerio) — hasil identik dengan extractSignalsFromDom. */
export function extractSignalsFromHtml(html: string): DocSignals {
  const $ = cheerio.load(html);

  const headings: DocHeading[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) headings.push({ level: Number(el.tagName.slice(1)), text });
  });

  const paragraphs: string[] = [];
  $("p").each((_, el) => {
    paragraphs.push($(el).text());
  });

  const links: { href: string }[] = [];
  $("a[href]").each((_, el) => {
    links.push({ href: $(el).attr("href") ?? "" });
  });

  // Sisipkan spasi antar blok agar word count konsisten (HTML minified).
  const $text = cheerio.load(html);
  $text("p, h1, h2, h3, h4, h5, h6, li, td, div").after(" ");

  return buildDocSignals({
    text: $text.root().text(),
    headings,
    paragraphs,
    links,
    listCount: $("ul, ol").length,
    verifyMarkers: extractVerifyMarkersFromHtml(html),
  });
}
