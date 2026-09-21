import { formatIdrShort } from "@/lib/finance-format";
import { escHtml, fmtMoney, fmtPct } from "./format";
import type { TrendPoint } from "./types";

/**
 * Grafik statis untuk PDF — renderer mematikan JavaScript, jadi semuanya
 * SVG/HTML yang dihitung di server. Palet seri sudah divalidasi (CVD, kontras
 * ≥3:1 terhadap kertas putih); hijau/merah dicadangkan untuk status.
 */
export const CHART_COLORS = {
  revenue: "#2a6fb0",
  expense: "#c9701a",
  ink: "#0f172a",
  muted: "#64748b",
  grid: "#e2e8f0",
  track: "#eef2f6",
  over: "#b91c1c",
} as const;

const num = (s: string | number) => {
  const n = typeof s === "number" ? s : Number(s);
  return Number.isFinite(n) ? n : 0;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

function shortAxis(n: number): string {
  if (n === 0) return "0";
  return formatIdrShort(n)
    .replace("Rp ", "")
    .replace(/(\d)\.(\d)/, "$1,$2");
}

/** Langkah sumbu "bulat" (1/2/2,5/5 × 10^n) agar label grid enak dibaca. */
function niceStep(range: number, ticks: number): number {
  const raw = range / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * pow;
}

/** Batang dengan ujung data membulat, rata di garis dasar. */
function barPath(x: number, w: number, y0: number, y1: number): string {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return "";
  const r = Math.min(3, w / 2, h);
  const up = y1 < y0;
  const s = up ? -1 : 1;
  return [
    `M${r1(x)},${r1(y0)}`,
    `V${r1(y1 - s * r)}`,
    `Q${r1(x)},${r1(y1)} ${r1(x + r)},${r1(y1)}`,
    `H${r1(x + w - r)}`,
    `Q${r1(x + w)},${r1(y1)} ${r1(x + w)},${r1(y1 - s * r)}`,
    `V${r1(y0)}Z`,
  ].join("");
}

export function chartPlaceholder(
  text = "Belum ada data untuk ditampilkan",
): string {
  return `<div class="chart-empty">${escHtml(text)}</div>`;
}

/**
 * Tren bulanan: batang pendapatan & beban berdampingan + garis hasil bersih,
 * satu sumbu (semua Rupiah). Label langsung hanya pada titik terakhir.
 */
export function svgTrendChart(trend: TrendPoint[]): string {
  const values = trend.flatMap((t) => [
    num(t.revenue),
    num(t.expense),
    num(t.net),
  ]);
  if (trend.length === 0 || values.every((v) => v === 0))
    return chartPlaceholder();

  const W = 680;
  const H = 250;
  const m = { top: 30, right: 16, bottom: 30, left: 58 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;

  const rawMax = Math.max(0, ...values);
  const rawMin = Math.min(0, ...values);
  const step = niceStep(rawMax - rawMin || 1, 4);
  const yMax = Math.ceil(rawMax / step) * step;
  const yMin = Math.floor(rawMin / step) * step;
  const y = (v: number) => m.top + ((yMax - v) / (yMax - yMin || 1)) * plotH;

  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) ticks.push(v);

  const band = plotW / trend.length;
  const barW = Math.min(26, band * 0.28);
  const gap = 2;

  const grid = ticks
    .map((v) => {
      const yy = r1(y(v));
      const zero = v === 0;
      return `<line x1="${m.left}" x2="${W - m.right}" y1="${yy}" y2="${yy}" stroke="${zero ? CHART_COLORS.muted : CHART_COLORS.grid}" stroke-width="${zero ? 1 : 0.75}"/>
<text x="${m.left - 8}" y="${yy + 3}" text-anchor="end" font-size="9" fill="${CHART_COLORS.muted}">${escHtml(shortAxis(v))}</text>`;
    })
    .join("");

  const y0 = y(0);
  const bars = trend
    .map((t, i) => {
      const cx = m.left + band * i + band / 2;
      const isLast = i === trend.length - 1;
      return `<path d="${barPath(cx - barW - gap / 2, barW, y0, y(num(t.revenue)))}" fill="${CHART_COLORS.revenue}"/>
<path d="${barPath(cx + gap / 2, barW, y0, y(num(t.expense)))}" fill="${CHART_COLORS.expense}"/>
<text x="${r1(cx)}" y="${H - 10}" text-anchor="middle" font-size="9.5" font-weight="${isLast ? 700 : 400}" fill="${isLast ? CHART_COLORS.ink : CHART_COLORS.muted}">${escHtml(t.label)}</text>`;
    })
    .join("");

  const pts = trend.map((t, i) => ({
    x: m.left + band * i + band / 2,
    y: y(num(t.net)),
  }));
  const line = `<polyline points="${pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ")}" fill="none" stroke="${CHART_COLORS.ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const dots = pts
    .map(
      (p) =>
        `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="4" fill="${CHART_COLORS.ink}" stroke="#ffffff" stroke-width="2"/>`,
    )
    .join("");

  const last = trend[trend.length - 1];
  const lastPt = pts[pts.length - 1];
  // Label langsung di atas pil putih — titik terakhir biasanya menimpa batang.
  const lastText = shortAxis(num(last.net));
  const pillW = lastText.length * 5.4 + 12;
  const pillY = Math.max(m.top - 8, lastPt.y - 25);
  const lastLabel = `<rect x="${r1(lastPt.x - pillW / 2)}" y="${r1(pillY)}" width="${r1(pillW)}" height="15" rx="7.5" fill="#ffffff" stroke="${CHART_COLORS.ink}" stroke-width="0.75"/>
<text x="${r1(lastPt.x)}" y="${r1(pillY + 10.8)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${CHART_COLORS.ink}">${escHtml(lastText)}</text>`;

  const legend = `<g font-size="9.5" fill="${CHART_COLORS.ink}">
<rect x="${m.left}" y="6" width="10" height="10" rx="2" fill="${CHART_COLORS.revenue}"/><text x="${m.left + 15}" y="15">Pendapatan</text>
<rect x="${m.left + 86}" y="6" width="10" height="10" rx="2" fill="${CHART_COLORS.expense}"/><text x="${m.left + 101}" y="15">Beban</text>
<line x1="${m.left + 146}" x2="${m.left + 164}" y1="11" y2="11" stroke="${CHART_COLORS.ink}" stroke-width="2"/><circle cx="${m.left + 155}" cy="11" r="3" fill="${CHART_COLORS.ink}"/><text x="${m.left + 170}" y="15">Laba/rugi bersih</text>
</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Tren pendapatan, beban, dan laba bersih" font-family="inherit">${legend}${grid}${bars}${line}${dots}${lastLabel}</svg>`;
}

export type BarListItem = {
  label: string;
  value: string;
  /** Teks kecil di kanan (mis. porsi %). */
  caption?: string;
};

/** Daftar batang horizontal satu seri (nilai positif), terurut dari pemanggil. */
export function htmlBarList(
  items: BarListItem[],
  color: string = CHART_COLORS.revenue,
): string {
  const max = Math.max(0, ...items.map((i) => num(i.value)));
  if (items.length === 0 || max <= 0) return chartPlaceholder();
  const rows = items
    .map((i) => {
      const pct = Math.max(0, Math.min(100, (num(i.value) / max) * 100));
      return `<div class="hbar-row">
  <div class="hbar-label">${escHtml(i.label)}</div>
  <div class="hbar-track"><span class="hbar-fill" style="width:${r1(pct)}%;background:${color}"></span></div>
  <div class="hbar-value">${escHtml(fmtMoney(i.value))}${i.caption ? `<span class="hbar-cap">${escHtml(i.caption)}</span>` : ""}</div>
</div>`;
    })
    .join("");
  return `<div class="hbar">${rows}</div>`;
}

/**
 * Meter pemakaian anggaran: skala 0–125%, penanda di 100%. Status "terlampaui"
 * tidak hanya lewat warna — pemanggil menambahkan label teks.
 */
export function htmlBudgetMeter(usedPct: number | null, over: boolean): string {
  if (usedPct == null) return `<span class="muted">${escHtml("–")}</span>`;
  const SCALE = 125;
  const width = (Math.max(0, Math.min(SCALE, usedPct)) / SCALE) * 100;
  const color = over ? CHART_COLORS.over : CHART_COLORS.revenue;
  return `<div class="meter" role="img" aria-label="Terpakai ${escHtml(fmtPct(usedPct))}">
  <span class="meter-fill" style="width:${r1(width)}%;background:${color}"></span>
  <span class="meter-mark" style="left:${r1((100 / SCALE) * 100)}%"></span>
</div>`;
}
