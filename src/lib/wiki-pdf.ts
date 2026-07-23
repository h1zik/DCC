/**
 * Pipeline PDF wiki: transform HTML TipTap → dokumen standalone, dirender
 * jadi PDF vektor asli oleh headless Chromium (`renderHtmlToPdfBuffer`).
 *
 * Server-only — dipanggil dari route handler unduhan (bukan lagi client,
 * karena render sekarang terjadi di server via Chromium, bukan html2canvas
 * di browser).
 */
import "server-only";
import * as cheerio from "cheerio";

const DANGEROUS_TAGS = ["script", "iframe", "object", "embed", "link", "meta", "base", "form"];

/**
 * Beda dari `sanitizeRichHtml` (dipakai export `.html`, yang membuang SEMUA
 * atribut `style`): di sini class & inline style justru harus dipertahankan
 * (warna teks, highlight, lebar kolom tabel) karena Chromium asli me-render
 * oklch()/CSS var/flex dengan benar — bukan seperti html2canvas yang crash.
 * Hanya buang konstruksi yang benar-benar berbahaya (script/JS eksekusi).
 *
 * Dipanggil PALING TERAKHIR, setelah `transformYoutubeEmbeds` — supaya iframe
 * YouTube yang legit sempat diubah jadi placeholder card dulu, sebelum semua
 * iframe (termasuk yang berbahaya) dibuang di sini.
 */
function stripDangerousMarkup(root: ReturnType<typeof cheerio.load>) {
  root(DANGEROUS_TAGS.join(",")).remove();

  root("*").each((_, el) => {
    if (el.type !== "tag") return;
    const attribs = { ...el.attribs };
    for (const name of Object.keys(attribs)) {
      const lower = name.toLowerCase();
      const value = attribs[name] ?? "";
      if (lower.startsWith("on")) {
        root(el).removeAttr(name);
        continue;
      }
      if (["href", "src", "xlink:href", "formaction", "action"].includes(lower)) {
        const v = value.trim().toLowerCase().replace(/[\s\-]/g, "");
        if (v.startsWith("javascript:") || v.startsWith("data:text/html") || v.startsWith("vbscript:")) {
          root(el).removeAttr(name);
        }
      }
    }
  });
}

/** Iframe cross-origin (mis. YouTube) tak perlu di-load nyata saat generate PDF. */
function transformYoutubeEmbeds(root: ReturnType<typeof cheerio.load>) {
  root("div[data-youtube-video]").each((_, el) => {
    const wrapper = root(el);
    const src = wrapper.find("iframe").attr("src") ?? "";
    const card = root(`<a class="pdf-embed-card"${src ? ` href="${src}"` : ""}></a>`);
    card.append(root("<strong>▶ Video YouTube</strong>"));
    card.append(root("<span></span>").text(src));
    wrapper.replaceWith(card);
  });
}

/**
 * Lebar kolom user tersimpan sebagai px — di-rescale ke persen supaya tabel
 * selalu muat di lebar printable (714px) tanpa kehilangan proporsi.
 */
function transformTableColumnWidths(root: ReturnType<typeof cheerio.load>) {
  root("table").each((_, table) => {
    const cols = root(table).find("colgroup col").toArray();
    if (cols.length === 0) return;
    const widths = cols.map((col) => {
      const style = root(col).attr("style") ?? "";
      // Kolom yang belum pernah di-resize manual dirender TipTap sebagai
      // `min-width: 48px` (bukan `width:`) — itu bukan lebar tetap, harus
      // dianggap "tidak diketahui" (dapat fallback), bukan dipatok 48px.
      const styleWidth = /(?<!min-)width:\s*([\d.]+)px/.exec(style)?.[1];
      const attrWidth = root(col).attr("width");
      const value = Number.parseFloat(styleWidth ?? attrWidth ?? "");
      return Number.isFinite(value) && value > 0 ? value : 0;
    });
    if (!widths.some((w) => w > 0)) return;
    const known = widths.filter((w) => w > 0);
    const fallback = known.reduce((sum, w) => sum + w, 0) / known.length;
    const filled = widths.map((w) => (w > 0 ? w : fallback));
    const total = filled.reduce((sum, w) => sum + w, 0);
    cols.forEach((col, index) => {
      root(col).removeAttr("width");
      root(col).attr("style", `width: ${((filled[index] / total) * 100).toFixed(2)}%`);
    });
  });
}

function expandDetails(root: ReturnType<typeof cheerio.load>) {
  root("details").attr("open", "");
}

/**
 * Transform HTML editor menjadi body siap-PDF: sanitasi, dan transform node
 * khusus yang masih relevan untuk konteks print (embed eksternal, lebar
 * kolom, `<details>` collapse).
 */
export function prepareWikiHtmlForPdf(contentHtml: string): string {
  if (!contentHtml || !contentHtml.trim()) return "";
  const $ = cheerio.load(contentHtml, null, false);

  transformYoutubeEmbeds($);
  transformTableColumnWidths($);
  expandDetails($);
  stripDangerousMarkup($);

  return $.html();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Dokumen standalone untuk Chromium print. Warna oklch/CSS var/flex/native
 * checkbox & list marker semuanya didukung native — tidak perlu workaround
 * seperti pada engine html2canvas lama.
 */
export function buildWikiPdfDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 40px; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111111;
           font: 14px/1.7 system-ui, -apple-system, "Segoe UI", sans-serif; }
    header h1 { font-size: 24px; font-weight: 700; line-height: 1.25; margin: 0 0 4px;
                border-bottom: 1px solid #e4e4e7; padding-bottom: 10px; }
    .wiki-body > * { margin: 0 0 12px; }
    h1 { font-size: 1.875rem; font-weight: 700; line-height: 1.25; margin: 20px 0 10px; }
    h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.3; margin: 18px 0 8px; }
    h3 { font-size: 1.25rem; font-weight: 600; line-height: 1.35; margin: 16px 0 6px; }
    h1, h2, h3 { break-after: avoid; }
    p { margin: 0 0 10px; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    u { text-decoration: underline; }
    s { text-decoration: line-through; color: #52525b; }
    a { color: #2563eb; text-decoration: underline; }
    mark { background: #fef08a; color: #111111; padding: 0 2px; border-radius: 2px; }

    /* Marker list dirender `outside` (di area padding kiri). 1.5em cuma pas
       untuk 1 digit; marker lebar seperti "10." / "12." / "viii." meluber ke
       kiri list box, masuk ke margin @page 40px, lalu terpotong Chromium.
       2.25em memberi ruang cukup + buffer supaya marker tak pernah menyentuh
       tepi cetak. */
    ul, ol { margin: 0 0 10px; padding: 0 0 0 2.25em; }
    ul { list-style-type: disc; }
    ul ul { list-style-type: circle; }
    ul ul ul { list-style-type: square; }
    ol { list-style-type: decimal; }
    ol ol { list-style-type: lower-alpha; }
    ol ol ol { list-style-type: lower-roman; }
    li { margin: 0 0 5px; line-height: 1.65; break-inside: avoid; }
    li p { margin: 0; }

    ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
    ul[data-type="taskList"] li > label { flex: 0 0 auto; margin-top: 3px; }
    ul[data-type="taskList"] li > div { flex: 1 1 0%; min-width: 0; }
    ul[data-type="taskList"] li[data-checked="true"] > div { color: #71717a; text-decoration: line-through; }
    ul[data-type="taskList"] input[type="checkbox"] { width: 14px; height: 14px; accent-color: #2563eb; }

    blockquote { border-left: 3px solid #d4d4d8; margin: 0 0 12px; padding: 2px 0 2px 12px;
                 color: #52525b; font-style: italic; break-inside: avoid; }
    hr { border: 0; border-top: 1px solid #e4e4e7; margin: 16px 0; }

    code { background: #f4f4f5; padding: 1px 5px; border-radius: 4px; font-size: 0.9em;
           font-family: ui-monospace, Consolas, monospace; color: #111111; }
    pre { background: #f6f8fa; border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px 14px;
          font-size: 12.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    pre code { background: transparent; padding: 0; }
    .hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
    .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section, .hljs-link { color: #d73a49; }
    .hljs-string, .hljs-title, .hljs-name, .hljs-type, .hljs-attribute, .hljs-symbol,
    .hljs-bullet, .hljs-addition, .hljs-variable, .hljs-template-tag, .hljs-template-variable { color: #22863a; }
    .hljs-number, .hljs-meta, .hljs-built_in, .hljs-builtin-name, .hljs-params { color: #005cc5; }
    .hljs-deletion { color: #b31d28; }

    table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 12px; font-size: 13px; }
    th, td { border: 1px solid #d4d4d8; padding: 6px 8px; vertical-align: top; text-align: left; word-break: break-word; }
    th { background: #f4f4f5; font-weight: 600; }
    tr { break-inside: avoid; }

    img { max-width: 100%; height: auto; display: block; margin: 12px auto; border-radius: 4px; break-inside: avoid; }
    img[data-align="left"] { margin-left: 0; margin-right: auto; }
    img[data-align="right"] { margin-left: auto; margin-right: 0; }
    img[data-align="center"] { margin-left: auto; margin-right: auto; }
    img[data-align="full"] { width: 100%; }

    .wiki-file-node, .wiki-embed-node, .pdf-embed-card {
      display: flex; align-items: center; gap: 10px; margin: 10px 0; padding: 10px 12px;
      border: 1px solid #d4d4d8; border-radius: 8px; background: #fafafa;
      color: #111111; text-decoration: none; break-inside: avoid; }
    .wiki-file-node__icon { display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border: 1px solid #d4d4d8; border-radius: 6px;
      background: #ffffff; flex: 0 0 auto; }
    .wiki-file-node__body { min-width: 0; }
    .wiki-file-node__name, .wiki-embed-node strong, .pdf-embed-card strong { display: block; font-weight: 600; }
    .wiki-file-node__meta, .wiki-embed-node span, .pdf-embed-card span {
      display: block; color: #71717a; font-size: 11px; word-break: break-all; }
    .pdf-embed-card { flex-direction: column; align-items: flex-start; gap: 2px; }

    div[data-type="callout"] { border-radius: 8px; border: 1px solid; padding: 10px 14px; margin: 0 0 12px;
      break-inside: avoid; }
    div[data-type="callout"][data-variant="info"] { background: #eff6ff; border-color: #bfdbfe; color: #1e3a8a; }
    div[data-type="callout"][data-variant="tip"] { background: #f0fdf4; border-color: #bbf7d0; color: #14532d; }
    div[data-type="callout"][data-variant="warning"] { background: #fffbeb; border-color: #fde68a; color: #78350f; }
    div[data-type="callout"][data-variant="danger"] { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }
    div[data-type="callout"] p:last-child { margin-bottom: 0; }

    details { border: 1px solid #e4e4e7; border-radius: 8px; padding: 8px 12px; margin: 0 0 12px; }
    details > summary { font-weight: 600; list-style: none; margin-bottom: 6px; }
    div[data-type="detailsContent"] { padding-top: 2px; }
  </style>
</head>
<body>
  <header><h1>${escapeHtml(title)}</h1></header>
  <article class="wiki-body">${bodyHtml}</article>
</body>
</html>`;
}
