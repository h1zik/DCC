import { describe, expect, it } from "vitest";
import { extractArticleSignals } from "@/lib/seo/content/competitor-extract";

const ARTICLE_PAGE = `<!doctype html>
<html>
<head>
  <title>10 Serum Niacinamide Terbaik 2026</title>
  <meta name="description" content="Rekomendasi serum niacinamide untuk kulit kusam." />
</head>
<body>
  <nav><a href="/">Home</a><a href="/promo">Promo besar hari ini jangan lewatkan</a></nav>
  <article>
    <h1>10 Serum Niacinamide Terbaik</h1>
    <p>Niacinamide membantu mencerahkan kulit kusam dan menjaga skin barrier.</p>
    <h2>Apa itu Niacinamide?</h2>
    <p>Niacinamide adalah turunan vitamin B3 yang populer di skincare.</p>
    <h3>Cara kerja</h3>
    <p>Bekerja dengan menjaga kelembapan dan meratakan warna kulit.</p>
    <h2>Rekomendasi Produk</h2>
    <p>Berikut daftar produk pilihan kami untuk semua jenis kulit.</p>
  </article>
  <footer>Copyright teks footer yang panjang sekali</footer>
  <script>console.log("tracking")</script>
</body>
</html>`;

describe("extractArticleSignals", () => {
  it("extracts title, meta description, headings, and word count from <article>", () => {
    const signals = extractArticleSignals(ARTICLE_PAGE);
    expect(signals.title).toBe("10 Serum Niacinamide Terbaik 2026");
    expect(signals.metaDescription).toBe(
      "Rekomendasi serum niacinamide untuk kulit kusam.",
    );
    expect(signals.headings).toEqual([
      { level: 2, text: "Apa itu Niacinamide?" },
      { level: 3, text: "Cara kerja" },
      { level: 2, text: "Rekomendasi Produk" },
    ]);
    // Konten nav/footer/script tidak ikut terhitung.
    expect(signals.bodyText).not.toContain("Promo besar");
    expect(signals.bodyText).not.toContain("tracking");
    expect(signals.wordCount).toBeGreaterThan(20);
  });

  it("falls back to body when no article/main exists", () => {
    const signals = extractArticleSignals(
      "<html><body><h2>Judul</h2><p>Satu dua tiga.</p></body></html>",
    );
    expect(signals.wordCount).toBe(4);
    expect(signals.headings).toEqual([{ level: 2, text: "Judul" }]);
  });

  it("handles empty html", () => {
    const signals = extractArticleSignals("");
    expect(signals.wordCount).toBe(0);
    expect(signals.title).toBeNull();
    expect(signals.headings).toEqual([]);
  });
});
