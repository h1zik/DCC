/**
 * Pipeline PDF wiki: transform HTML TipTap → dokumen standalone ber-tag
 * `data-pdf-block`, dirender oleh engine blok-aware `downloadHtmlAsPdf`
 * (page break jatuh di antara blok, bukan memotong baris teks).
 *
 * Client-only (DOMParser) — import secara dynamic dari kode client.
 */

/** Blok lebih tinggi dari ini dipecah per anak (li/tr/…). 1 halaman A4 printable ≈ 1168px CSS. */
const MAX_BLOCK_CSS_PX = 900;

const CLASS_ALLOWLIST = new Set([
  "wiki-file-node",
  "wiki-file-node__icon",
  "wiki-file-node__body",
  "wiki-file-node__name",
  "wiki-file-node__meta",
  "wiki-embed-node",
  "pdf-list",
  "pdf-list-item",
  "pdf-list-marker",
  "pdf-list-marker--ordered",
  "pdf-list-content",
  "pdf-checkbox",
  "pdf-checkbox-mark",
  "pdf-embed-card",
]);

const COLOR_VALUE =
  /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg]+\))$/;
const LENGTH_VALUE = /^-?[\d.]+(px|pt|em|rem|%)$/;
const TEXT_ALIGN_VALUE = /^(left|center|right|justify)$/;

const STYLE_ALLOWLIST: Record<string, RegExp> = {
  color: COLOR_VALUE,
  "background-color": COLOR_VALUE,
  "text-align": TEXT_ALIGN_VALUE,
  width: LENGTH_VALUE,
  height: LENGTH_VALUE,
  "min-width": LENGTH_VALUE,
  "font-size": LENGTH_VALUE,
};

/** Class tema (oklch/var) dibuang; class fungsional wiki + hljs-* dipertahankan. */
function sanitizeClasses(root: HTMLElement) {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[class]"))) {
    const kept = Array.from(el.classList).filter(
      (token) => CLASS_ALLOWLIST.has(token) || token.startsWith("hljs"),
    );
    if (kept.length > 0) el.setAttribute("class", kept.join(" "));
    else el.removeAttribute("class");
  }
}

/**
 * Inline style di-allowlist ketat: html2canvas 1.4.1 crash/garble pada
 * oklch()/lab()/color-mix()/var() — hanya nilai hex/rgb/hsl & panjang valid
 * yang lolos. Warna teks/highlight TipTap tersimpan sebagai rgb/hex → aman.
 */
function sanitizeInlineStyles(root: HTMLElement) {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[style]"))) {
    const raw = el.getAttribute("style") ?? "";
    const kept: string[] = [];
    for (const declaration of raw.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      const pattern = STYLE_ALLOWLIST[property];
      if (pattern?.test(value)) kept.push(`${property}: ${value}`);
    }
    if (kept.length > 0) el.setAttribute("style", kept.join("; "));
    else el.removeAttribute("style");
  }
}

function transformHighlightMarks(root: HTMLElement) {
  for (const mark of Array.from(root.querySelectorAll<HTMLElement>("mark"))) {
    const color = mark.getAttribute("data-color")?.trim() ?? "";
    if (COLOR_VALUE.test(color)) {
      mark.setAttribute("style", `background-color: ${color}`);
    }
  }
}

/** Checkbox native tidak reliable di html2canvas — ganti span yang digambar CSS. */
function transformTaskLists(root: HTMLElement) {
  for (const item of Array.from(
    root.querySelectorAll<HTMLElement>('ul[data-type="taskList"] > li'),
  )) {
    const input = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const checked =
      item.getAttribute("data-checked") === "true" ||
      input?.hasAttribute("checked") === true;
    item.querySelector(":scope > label")?.remove();
    input?.remove();
    const box = item.ownerDocument.createElement("span");
    box.className = "pdf-checkbox";
    box.setAttribute("data-checked", checked ? "true" : "false");
    const tick = item.ownerDocument.createElement("span");
    tick.className = "pdf-checkbox-mark";
    tick.textContent = "✓";
    box.appendChild(tick);
    item.insertBefore(box, item.firstChild);
  }
}

function alphaListMarker(value: number): string {
  let current = Math.max(1, value);
  let result = "";
  while (current > 0) {
    current -= 1;
    result = String.fromCharCode(97 + (current % 26)) + result;
    current = Math.floor(current / 26);
  }
  return result;
}

function romanListMarker(value: number): string {
  const parts: Array<[number, string]> = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];
  let current = Math.max(1, value);
  let result = "";
  for (const [amount, glyph] of parts) {
    while (current >= amount) {
      result += glyph;
      current -= amount;
    }
  }
  return result;
}

export function formatPdfOrderedListMarker(value: number, depth: number): string {
  if (depth % 3 === 1) return `${alphaListMarker(value)}.`;
  if (depth % 3 === 2) return `${romanListMarker(value)}.`;
  return `${value}.`;
}

/**
 * Marker list native bergeser dari baseline ketika diraster oleh html2canvas.
 * Ganti dengan span teks eksplisit (glyph •/◦/▪ atau nomor) — html2canvas
 * menggambar semua teks dengan offset baseline yang sama, jadi marker teks
 * selalu sejajar dengan baris pertama konten; elemen yang digambar CSS
 * (mis. dot 5px) tidak ikut offset itu dan tampak "naik" di PDF.
 */
function transformListMarkers(root: HTMLElement) {
  const lists = Array.from(
    root.querySelectorAll<HTMLUListElement | HTMLOListElement>(
      'ul:not([data-type="taskList"]), ol',
    ),
  );

  for (const list of lists) {
    const items = Array.from(list.children).filter(
      (child): child is HTMLLIElement => child.tagName === "LI",
    );
    let depth = 0;
    let ancestor = list.parentElement?.closest("ul, ol") ?? null;
    while (ancestor) {
      depth += 1;
      ancestor = ancestor.parentElement?.closest("ul, ol") ?? null;
    }

    const ordered = list.tagName === "OL";
    const reversed = ordered && list.hasAttribute("reversed");
    let ordinal = Number.parseInt(list.getAttribute("start") ?? "", 10);
    if (!Number.isFinite(ordinal)) ordinal = reversed ? items.length : 1;

    list.classList.add("pdf-list");

    for (const item of items) {
      const explicitValue = Number.parseInt(item.getAttribute("value") ?? "", 10);
      if (Number.isFinite(explicitValue)) ordinal = explicitValue;

      const marker = item.ownerDocument.createElement("span");
      marker.className = "pdf-list-marker";
      marker.setAttribute("aria-hidden", "true");

      if (ordered) {
        marker.classList.add("pdf-list-marker--ordered");
        marker.textContent = formatPdfOrderedListMarker(ordinal, depth);
      } else {
        marker.textContent =
          depth % 3 === 1 ? "◦" : depth % 3 === 2 ? "▪" : "•";
      }

      const content = item.ownerDocument.createElement("div");
      content.className = "pdf-list-content";
      while (item.firstChild) content.appendChild(item.firstChild);
      item.classList.add("pdf-list-item");
      item.append(marker, content);

      ordinal += reversed ? -1 : 1;
    }
  }
}

/** Iframe cross-origin selalu blank di html2canvas — ganti kartu placeholder. */
function transformYoutubeEmbeds(root: HTMLElement) {
  for (const wrapper of Array.from(
    root.querySelectorAll<HTMLElement>("div[data-youtube-video]"),
  )) {
    const src = wrapper.querySelector("iframe")?.getAttribute("src") ?? "";
    const card = wrapper.ownerDocument.createElement("a");
    card.className = "pdf-embed-card";
    if (src) card.setAttribute("href", src);
    const label = wrapper.ownerDocument.createElement("strong");
    label.textContent = "▶ Video YouTube";
    const url = wrapper.ownerDocument.createElement("span");
    url.textContent = src;
    card.append(label, url);
    wrapper.replaceWith(card);
  }
}

/**
 * Lebar kolom user tersimpan sebagai px — di-rescale ke persen supaya tabel
 * selalu muat di lebar printable (714px) tanpa kehilangan proporsi.
 */
function transformTableColumnWidths(root: HTMLElement) {
  for (const table of Array.from(root.querySelectorAll("table"))) {
    const cols = Array.from(table.querySelectorAll<HTMLTableColElement>("colgroup col"));
    if (cols.length === 0) continue;
    const widths = cols.map((col) => {
      const styleWidth = /([\d.]+)px/.exec(col.getAttribute("style") ?? "")?.[1];
      const attrWidth = col.getAttribute("width");
      const value = Number.parseFloat(styleWidth ?? attrWidth ?? "");
      return Number.isFinite(value) && value > 0 ? value : 0;
    });
    if (!widths.some((width) => width > 0)) continue;
    const known = widths.filter((width) => width > 0);
    const fallback = known.reduce((sum, width) => sum + width, 0) / known.length;
    const filled = widths.map((width) => (width > 0 ? width : fallback));
    const total = filled.reduce((sum, width) => sum + width, 0);
    cols.forEach((col, index) => {
      col.removeAttribute("width");
      col.setAttribute("style", `width: ${((filled[index] / total) * 100).toFixed(2)}%`);
    });
  }
}

function expandDetails(root: HTMLElement) {
  for (const details of Array.from(root.querySelectorAll("details"))) {
    details.setAttribute("open", "");
  }
}

/**
 * Transform HTML editor menjadi body siap-PDF: class allowlist, sanitasi
 * inline style, transform node khusus, dan tag `data-pdf-block` per blok
 * top-level (flat, tidak nested — kontrak `measureBlockBandsPx`).
 */
export function prepareWikiHtmlForPdf(contentHtml: string): string {
  const doc = new DOMParser().parseFromString(contentHtml, "text/html");
  const body = doc.body;

  transformHighlightMarks(body);
  transformTaskLists(body);
  transformListMarkers(body);
  transformYoutubeEmbeds(body);
  transformTableColumnWidths(body);
  expandDetails(body);
  sanitizeClasses(body);
  sanitizeInlineStyles(body);

  for (const child of Array.from(body.children)) {
    child.setAttribute("data-pdf-block", "");
  }
  return body.innerHTML;
}

/**
 * Hook `beforeCapture`: berjalan di iframe engine setelah layout final.
 * Blok yang lebih tinggi dari satu halaman di-demote ke anak-anaknya supaya
 * page break tetap jatuh di antara baris/item, bukan memotong glyph.
 */
export function refineWikiPdfBlocks(doc: Document): void {
  const queue = Array.from(doc.querySelectorAll<HTMLElement>("[data-pdf-block]"));
  while (queue.length > 0) {
    const el = queue.shift();
    if (!el) break;
    if (el.getBoundingClientRect().height <= MAX_BLOCK_CSS_PX) continue;

    const tag = el.tagName.toLowerCase();
    let children: HTMLElement[] = [];
    if (tag === "ul" || tag === "ol") {
      children = Array.from(el.children).filter(
        (child): child is HTMLElement => child.tagName === "LI",
      );
    } else if (tag === "table") {
      children = Array.from(el.querySelectorAll<HTMLElement>("tr"));
    } else if (
      tag === "blockquote" ||
      tag === "details" ||
      (tag === "div" && el.getAttribute("data-type") === "callout")
    ) {
      const nodes = Array.from(el.childNodes);
      const onlyElements = nodes.every(
        (node) =>
          node.nodeType === Node.ELEMENT_NODE ||
          (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()),
      );
      if (onlyElements) {
        children = nodes.filter(
          (node): node is HTMLElement => node.nodeType === Node.ELEMENT_NODE,
        );
      }
    }
    // Blok atom raksasa (gambar/pre > 1 halaman): biarkan — engine memakai
    // fallback slicing untuk kasus yang memang tak terhindarkan ini.
    if (children.length === 0) continue;

    el.removeAttribute("data-pdf-block");
    for (const child of children) {
      child.setAttribute("data-pdf-block", "");
      queue.push(child);
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Dokumen standalone untuk engine PDF. Semua warna hex/rgb literal, tanpa
 * pseudo-element (kecuali marker list native) — batasan html2canvas 1.4.1.
 * Margin bawah blok ≥ 10px agar band-bleed engine jatuh di whitespace.
 */
export function buildWikiPdfDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 40px; width: 794px; background: #ffffff; color: #111111;
           font: 14px/1.7 system-ui, -apple-system, "Segoe UI", sans-serif; }
    header h1 { font-size: 24px; font-weight: 700; line-height: 1.25; margin: 0 0 4px;
                border-bottom: 1px solid #e4e4e7; padding-bottom: 10px; }
    .wiki-body > * { margin: 0 0 12px; }
    h1 { font-size: 1.875rem; font-weight: 700; line-height: 1.25; margin: 20px 0 10px; }
    h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.3; margin: 18px 0 8px; }
    h3 { font-size: 1.25rem; font-weight: 600; line-height: 1.35; margin: 16px 0 6px; }
    p { margin: 0 0 10px; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    u { text-decoration: underline; }
    s { text-decoration: line-through; color: #52525b; }
    a { color: #2563eb; text-decoration: underline; }
    mark { background: #fef08a; color: #111111; padding: 0 2px; border-radius: 2px; }

    /* Defense bullet-drop html2canvas: outside + display:list-item + padding kiri di list */
    ul, ol { margin: 0 0 10px; padding: 0 0 0 1.5em; list-style-position: outside; }
    ul { list-style-type: disc; }
    ul ul { list-style-type: circle; }
    ul ul ul { list-style-type: square; }
    ol { list-style-type: decimal; }
    ol ol { list-style-type: lower-alpha; }
    ol ol ol { list-style-type: lower-roman; }
    li { display: list-item; margin: 0 0 5px; padding-left: 0.15em; line-height: 1.65; }
    li > ul, li > ol { margin: 5px 0 0; }
    li p { margin: 0; }

    /* Marker = teks (glyph/nomor): html2canvas menggeser semua teks dengan offset
       baseline yang sama, jadi marker teks otomatis sejajar dengan konten. */
    .pdf-list { list-style: none; padding-left: 0; }
    .pdf-list-item { display: flex; align-items: flex-start; gap: 0.4em; padding-left: 0; }
    .pdf-list-marker { flex: 0 0 auto; min-width: 1.15em; text-align: right;
                       line-height: 1.65; white-space: nowrap; }
    .pdf-list-marker--ordered { min-width: 1.65em; font-variant-numeric: tabular-nums; }
    .pdf-list-content { flex: 1 1 0%; min-width: 0; }
    .pdf-list-content > .pdf-list { margin-top: 5px; margin-bottom: 0; }

    ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
    ul[data-type="taskList"] li > div { flex: 1 1 0%; min-width: 0; }
    ul[data-type="taskList"] li[data-checked="true"] > div { color: #71717a; text-decoration: line-through; }
    .pdf-checkbox { flex: 0 0 auto; width: 14px; height: 14px; margin-top: 6px;
                    border: 1.5px solid #52525b; border-radius: 3px; background: #ffffff;
                    display: inline-flex; align-items: center; justify-content: center; }
    .pdf-checkbox[data-checked="true"] { background: #2563eb; border-color: #2563eb; }
    .pdf-checkbox-mark { display: none; }
    .pdf-checkbox[data-checked="true"] .pdf-checkbox-mark { display: block; color: #ffffff; font-size: 10px; line-height: 1; }

    blockquote { border-left: 3px solid #d4d4d8; margin: 0 0 12px; padding: 2px 0 2px 12px;
                 color: #52525b; font-style: italic; }
    hr { border: 0; border-top: 1px solid #e4e4e7; margin: 16px 0; }

    /* pre-wrap wajib: overflow-x = konten terpotong pada capture canvas */
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
    tr[data-row-height] > th, tr[data-row-height] > td { height: inherit; }

    img { max-width: 100%; height: auto; display: block; margin: 12px auto; border-radius: 4px; }
    img[data-align="left"] { margin-left: 0; margin-right: auto; }
    img[data-align="right"] { margin-left: auto; margin-right: 0; }
    img[data-align="center"] { margin-left: auto; margin-right: auto; }
    img[data-align="full"] { width: 100%; }

    .wiki-file-node, .wiki-embed-node, .pdf-embed-card {
      display: flex; align-items: center; gap: 10px; margin: 10px 0; padding: 10px 12px;
      border: 1px solid #d4d4d8; border-radius: 8px; background: #fafafa;
      color: #111111; text-decoration: none; }
    .wiki-file-node__icon { display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border: 1px solid #d4d4d8; border-radius: 6px;
      background: #ffffff; flex: 0 0 auto; }
    .wiki-file-node__body { min-width: 0; }
    .wiki-file-node__name, .wiki-embed-node strong, .pdf-embed-card strong { display: block; font-weight: 600; }
    .wiki-file-node__meta, .wiki-embed-node span, .pdf-embed-card span {
      display: block; color: #71717a; font-size: 11px; word-break: break-all; }
    .pdf-embed-card { flex-direction: column; align-items: flex-start; gap: 2px; }

    div[data-type="callout"] { border-radius: 8px; border: 1px solid; padding: 10px 14px; margin: 0 0 12px; }
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
  <header data-pdf-block><h1>${escapeHtml(title)}</h1></header>
  <article class="wiki-body">${bodyHtml}</article>
</body>
</html>`;
}
