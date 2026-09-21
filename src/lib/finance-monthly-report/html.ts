import {
  FINANCE_TYPE_GROUP_ORDER,
  FINANCE_TYPE_LABEL,
} from "@/lib/finance-format";
import {
  CHART_COLORS,
  htmlBarList,
  htmlBudgetMeter,
  svgTrendChart,
} from "./charts";
import {
  cssString,
  EN_DASH,
  escHtml,
  fmtDateTimeJakarta,
  fmtDateUtc,
  fmtDeltaPct,
  fmtMoney,
  fmtMoneyShort,
  fmtPct,
  pctChange,
} from "./format";
import type {
  AgingSide,
  BalanceSheetLine,
  Highlight,
  MoneyPair,
  MonthlyReportData,
} from "./types";

const num = (s: string | number) => Number(s) || 0;
const diff = (a: string, b: string) => num(a) - num(b);

// ── Potongan kecil ─────────────────────────────────────────────────────────

/** Segitiga SVG — tidak bergantung pada glyph ▲▼ font container produksi. */
function arrow(direction: "up" | "down" | "flat"): string {
  if (direction === "flat")
    return `<svg class="arrow" viewBox="0 0 8 8" aria-hidden="true"><rect x="1" y="3.25" width="6" height="1.5" fill="currentColor"/></svg>`;
  const d = direction === "up" ? "M4 1 7.5 7h-7z" : "M4 7 .5 1h7z";
  return `<svg class="arrow" viewBox="0 0 8 8" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
}

function deltaChip(pair: MoneyPair, vsLabel: string, invert = false): string {
  const p = pair.deltaPct;
  if (num(pair.current) === 0 && num(pair.previous) === 0)
    return `<span class="chip chip-info">tidak ada aktivitas</span>`;
  if (p == null)
    return `<span class="chip chip-info">baru · vs ${escHtml(vsLabel)}</span>`;
  const dir = p > 0 ? "up" : p < 0 ? "down" : "flat";
  const good = invert ? p < 0 : p > 0;
  const tone = p === 0 ? "info" : good ? "pos" : "neg";
  return `<span class="chip chip-${tone}">${arrow(dir)}${escHtml(fmtDeltaPct(p))} <span class="chip-vs">vs ${escHtml(vsLabel)}</span></span>`;
}

function statusBadge(d: MonthlyReportData): string {
  const lock = d.meta.lock;
  if (lock) {
    const by = lock.lockedByName ? ` oleh ${escHtml(lock.lockedByName)}` : "";
    return `<span class="badge badge-final">FINAL</span><span class="badge-note">Periode dikunci ${escHtml(fmtDateTimeJakarta(lock.lockedAtIso))}${by}</span>`;
  }
  return `<span class="badge badge-draft">DRAFT</span><span class="badge-note">Periode belum dikunci — angka masih dapat berubah</span>`;
}

function sectionHead(
  no: number | string,
  title: string,
  caption: string,
): string {
  return `<header class="sec-head">
  <span class="sec-no">${escHtml(String(no))}</span>
  <h2>${escHtml(title)}</h2>
  <span class="sec-cap">${escHtml(caption)}</span>
</header>`;
}

function emptyRow(
  cols: number,
  text = "Tidak ada transaksi terposting pada periode ini",
): string {
  return `<tr class="empty"><td colspan="${cols}">${escHtml(text)}</td></tr>`;
}

function scopeTag(text: string): string {
  return `<p class="scope">${escHtml(text)}</p>`;
}

/** Sel selisih & % untuk tabel perbandingan. `invert`: kenaikan = buruk (beban). */
function compareCells(
  current: string,
  previous: string,
  invert = false,
): string {
  const delta = diff(current, previous);
  const pct = pctChange(current, previous);
  const good = invert ? delta < 0 : delta > 0;
  const tone = delta === 0 ? "" : good ? " pos" : " neg";
  const pctText =
    num(current) === 0 && num(previous) === 0 ? EN_DASH : fmtDeltaPct(pct);
  return `<td class="num${tone}">${escHtml(fmtMoney(delta))}</td><td class="num${tone}">${escHtml(pctText)}</td>`;
}

// ── Bagian ─────────────────────────────────────────────────────────────────

function cover(d: MonthlyReportData): string {
  const { meta } = d;
  const scope = meta.brand
    ? `Brand: ${meta.brand.name}`
    : "Seluruh brand (konsolidasi)";
  const dataTo = meta.isInProgress
    ? `Data s.d. ${fmtDateUtc(meta.effectiveToIso)} (bulan berjalan)`
    : `${fmtDateUtc(meta.fromIso)} – ${fmtDateUtc(meta.toIso)}`;
  const logo = meta.logoPath
    ? `<img class="cover-logo" src="${escHtml(meta.logoPath)}" alt="" />`
    : "";
  return `<div class="cover">
  <div class="cover-top">
    ${logo}<span class="cover-org">${escHtml(meta.appName)}</span>
    <span class="cover-conf">RAHASIA · INTERNAL</span>
  </div>
  <div class="cover-main">
    <div class="cover-kicker">Laporan Keuangan Bulanan</div>
    <h1>${escHtml(meta.periodLabel)}</h1>
    <div class="cover-rule"></div>
    <p class="cover-scope">${escHtml(scope)}</p>
    <p class="cover-range">${escHtml(dataTo)}</p>
    <div class="cover-status">${statusBadge(d)}</div>
  </div>
  <div class="cover-foot">
    <div><span class="cf-label">Disusun oleh</span>${escHtml(meta.generatedByName ?? "Tim Finance")}</div>
    <div><span class="cf-label">Dicetak</span>${escHtml(fmtDateTimeJakarta(meta.generatedAtIso))}</div>
    <div><span class="cf-label">Mata uang</span>Rupiah (IDR)</div>
  </div>
</div>`;
}

function kpiCard(
  label: string,
  value: string,
  full: string,
  chip: string,
): string {
  return `<div class="kpi">
  <div class="kpi-label">${escHtml(label)}</div>
  <div class="kpi-value">${escHtml(value)}</div>
  <div class="kpi-full">${escHtml(full)}</div>
  <div class="kpi-chip">${chip}</div>
</div>`;
}

function highlightsBox(items: Highlight[]): string {
  if (items.length === 0) return "";
  const li = items
    .map(
      (h) =>
        `<li class="hl hl-${h.tone}"><span class="hl-dot"></span><span>${escHtml(h.text)}</span></li>`,
    )
    .join("");
  return `<div class="highlights"><h3>Sorotan</h3><ul>${li}</ul></div>`;
}

function summary(d: MonthlyReportData): string {
  const { kpis, meta } = d;
  const vs = meta.prevPeriodLabel;
  const netLabel = num(kpis.net.current) < 0 ? "Rugi bersih" : "Laba bersih";
  const marginChip =
    kpis.marginPct != null && kpis.prevMarginPct != null
      ? `<span class="chip chip-info">${escHtml(`${kpis.prevMarginPct < 0 ? "−" : ""}${fmtPct(kpis.prevMarginPct)}`)} <span class="chip-vs">di ${escHtml(vs)}</span></span>`
      : `<span class="chip chip-info">tanpa pembanding</span>`;
  const full = (s: string) => fmtMoney(s, { withRp: true, zeroDash: false });

  const cards = [
    kpiCard(
      "Pendapatan",
      fmtMoneyShort(kpis.revenue.current),
      full(kpis.revenue.current),
      deltaChip(kpis.revenue, vs),
    ),
    kpiCard(
      "Beban",
      fmtMoneyShort(kpis.expense.current),
      full(kpis.expense.current),
      deltaChip(kpis.expense, vs, true),
    ),
    kpiCard(
      netLabel,
      fmtMoneyShort(kpis.net.current),
      full(kpis.net.current),
      deltaChip(kpis.net, vs),
    ),
    kpiCard(
      "Margin bersih",
      kpis.marginPct == null
        ? EN_DASH
        : `${kpis.marginPct < 0 ? "−" : ""}${fmtPct(kpis.marginPct)}`,
      "Laba bersih ÷ pendapatan",
      marginChip,
    ),
    kpiCard(
      "Arus kas bersih",
      fmtMoneyShort(kpis.cashNet.current),
      full(kpis.cashNet.current),
      deltaChip(kpis.cashNet, vs),
    ),
    kpiCard(
      "Saldo kas & bank",
      fmtMoneyShort(kpis.cashAndBank),
      full(kpis.cashAndBank),
      `<span class="chip chip-info">per ${escHtml(fmtDateUtc(meta.effectiveToIso))}</span>`,
    ),
  ].join("");

  return `<section class="report-section">
${sectionHead(1, "Ringkasan Eksekutif", meta.periodLabel)}
<div class="status-strip">${statusBadge(d)}</div>
<div class="kpi-grid">${cards}</div>
${highlightsBox(d.highlights)}
<figure class="figure">
  <figcaption><strong>Tren ${d.trend.length} bulan</strong> — pendapatan, beban, dan laba/rugi bersih (Rupiah)</figcaption>
  ${svgTrendChart(d.trend)}
</figure>
</section>`;
}

function profitLoss(d: MonthlyReportData): string {
  const { profitLoss: pl, meta } = d;
  const group = (type: "REVENUE" | "EXPENSE") => {
    const rows = pl.rows.filter((r) => r.type === type);
    if (rows.length === 0) return emptyRow(6, "Tidak ada mutasi");
    return rows
      .map(
        (r) => `<tr>
  <td class="code">${escHtml(r.code)}</td><td>${escHtml(r.name)}</td>
  <td class="num">${escHtml(fmtMoney(r.current))}</td><td class="num muted">${escHtml(fmtMoney(r.previous))}</td>
  ${compareCells(r.current, r.previous, type === "EXPENSE")}
</tr>`,
      )
      .join("");
  };
  const totalRow = (
    label: string,
    p: MoneyPair,
    cls: string,
    invert = false,
  ) => `<tr class="${cls}">
  <td></td><td>${escHtml(label)}</td>
  <td class="num">${escHtml(fmtMoney(p.current, { zeroDash: false }))}</td><td class="num">${escHtml(fmtMoney(p.previous, { zeroDash: false }))}</td>
  ${compareCells(p.current, p.previous, invert)}
</tr>`;

  const top = d.topExpenses.length
    ? `<figure class="figure">
  <figcaption><strong>${d.topExpenses.length} beban terbesar</strong> — porsi terhadap total beban bulan ini</figcaption>
  ${htmlBarList(
    d.topExpenses.map((e) => ({
      label: `${e.code} ${e.name}`,
      value: e.amount,
      caption: fmtPct(e.sharePct),
    })),
    CHART_COLORS.expense,
  )}
</figure>`
    : "";

  return `<section class="report-section">
${sectionHead(2, "Laporan Laba Rugi", `${meta.periodLabel} vs ${meta.prevPeriodLabel}`)}
<table class="fin">
  <colgroup><col style="width:9%"/><col/><col style="width:17%"/><col style="width:17%"/><col style="width:15%"/><col style="width:10%"/></colgroup>
  <thead><tr><th>Kode</th><th>Akun</th><th class="num">${escHtml(meta.periodLabel)}</th><th class="num">${escHtml(meta.prevPeriodLabel)}</th><th class="num">Selisih</th><th class="num">%</th></tr></thead>
  <tbody>
    <tr class="group"><td colspan="6">Pendapatan</td></tr>
    ${group("REVENUE")}
    ${totalRow("Total pendapatan", pl.revenue, "subtotal")}
    <tr class="group"><td colspan="6">Beban</td></tr>
    ${group("EXPENSE")}
    ${totalRow("Total beban", pl.expense, "subtotal", true)}
    ${totalRow(num(pl.netIncome.current) < 0 ? "Rugi bersih" : "Laba bersih", pl.netIncome, "total")}
  </tbody>
</table>
${top}
</section>`;
}

function balanceSheet(d: MonthlyReportData): string {
  const { balanceSheet: bs, meta } = d;
  const cur = bs.current;
  const prev = bs.previous;

  const lines = (
    curLines: BalanceSheetLine[],
    prevLines: BalanceSheetLine[],
  ) => {
    const prevByCode = new Map(prevLines.map((l) => [l.code, l.amount]));
    const seen = new Set(curLines.map((l) => l.code));
    const merged = [
      ...curLines.map((l) => ({
        ...l,
        previous: prevByCode.get(l.code) ?? "0",
      })),
      ...prevLines
        .filter((l) => !seen.has(l.code))
        .map((l) => ({
          code: l.code,
          name: l.name,
          amount: "0",
          previous: l.amount,
        })),
    ].sort((a, b) => a.code.localeCompare(b.code));
    if (merged.length === 0) return emptyRow(5, "Tidak ada saldo");
    return merged
      .map(
        (
          l,
        ) => `<tr><td class="code">${escHtml(l.code)}</td><td>${escHtml(l.name)}</td>
  <td class="num">${escHtml(fmtMoney(l.amount))}</td><td class="num muted">${escHtml(fmtMoney(l.previous))}</td>
  <td class="num">${escHtml(fmtMoney(diff(l.amount, l.previous)))}</td></tr>`,
      )
      .join("");
  };
  const total = (
    label: string,
    a: string,
    b: string,
    cls: string,
  ) => `<tr class="${cls}"><td></td><td>${escHtml(label)}</td>
  <td class="num">${escHtml(fmtMoney(a, { zeroDash: false }))}</td><td class="num">${escHtml(fmtMoney(b, { zeroDash: false }))}</td>
  <td class="num">${escHtml(fmtMoney(diff(a, b)))}</td></tr>`;

  const liabEq = (s: typeof cur) =>
    String(num(s.totalLiabilities) + num(s.totalEquity));

  let note = "";
  if (meta.brand) {
    note = scopeTag(
      "Tampilan segmen brand — hanya baris jurnal bertag brand ini, sehingga neraca tidak diharapkan seimbang.",
    );
  } else if (!cur.isBalanced) {
    note = `<div class="callout callout-neg"><strong>Neraca tidak seimbang.</strong> Selisih aset terhadap kewajiban + ekuitas: ${escHtml(fmtMoney(cur.difference, { withRp: true, zeroDash: false }))}. Periksa jurnal sebelum laporan difinalkan.</div>`;
  } else {
    note = `<p class="check-ok">Aset = Kewajiban + Ekuitas — neraca seimbang.</p>`;
  }

  return `<section class="report-section">
${sectionHead(3, "Neraca (Laporan Posisi Keuangan)", `Per ${fmtDateUtc(bs.asOfIso)}`)}
${note}
<table class="fin">
  <colgroup><col style="width:9%"/><col/><col style="width:19%"/><col style="width:19%"/><col style="width:17%"/></colgroup>
  <thead><tr><th>Kode</th><th>Akun</th><th class="num">${escHtml(fmtDateUtc(bs.asOfIso))}</th><th class="num">${escHtml(fmtDateUtc(bs.previousAsOfIso))}</th><th class="num">Perubahan</th></tr></thead>
  <tbody>
    <tr class="group"><td colspan="5">Aset</td></tr>
    ${lines(cur.assets, prev.assets)}
    ${total("Total aset", cur.totalAssets, prev.totalAssets, "total")}
    <tr class="group"><td colspan="5">Kewajiban</td></tr>
    ${lines(cur.liabilities, prev.liabilities)}
    ${total("Total kewajiban", cur.totalLiabilities, prev.totalLiabilities, "subtotal")}
    <tr class="group"><td colspan="5">Ekuitas</td></tr>
    ${lines(cur.equity, prev.equity)}
    <tr><td class="code"></td><td>Laba ditahan &amp; laba berjalan</td>
      <td class="num">${escHtml(fmtMoney(cur.retainedEarnings))}</td><td class="num muted">${escHtml(fmtMoney(prev.retainedEarnings))}</td>
      <td class="num">${escHtml(fmtMoney(diff(cur.retainedEarnings, prev.retainedEarnings)))}</td></tr>
    ${total("Total ekuitas", cur.totalEquity, prev.totalEquity, "subtotal")}
    ${total("Total kewajiban + ekuitas", liabEq(cur), liabEq(prev), "total")}
  </tbody>
</table>
</section>`;
}

function cashFlow(d: MonthlyReportData): string {
  const { cashFlow: cf, meta } = d;
  const groups = cf.groups
    .map((g) => {
      const rows = g.byCounterAccount.length
        ? g.byCounterAccount
            .map(
              (
                c,
              ) => `<tr><td class="code">${escHtml(c.code)}</td><td>${escHtml(c.name)}</td>
  <td class="num">${escHtml(fmtMoney(c.inflow))}</td><td class="num">${escHtml(fmtMoney(c.outflow))}</td><td class="num">${escHtml(fmtMoney(c.net))}</td></tr>`,
            )
            .join("")
        : emptyRow(5, "Tidak ada mutasi kas");
      return `<tr class="group"><td colspan="5">${escHtml(g.label)}</td></tr>${rows}
<tr class="subtotal"><td></td><td>Kas bersih dari ${escHtml(g.label.toLowerCase())}</td>
  <td class="num">${escHtml(fmtMoney(g.inflow, { zeroDash: false }))}</td><td class="num">${escHtml(fmtMoney(g.outflow, { zeroDash: false }))}</td><td class="num">${escHtml(fmtMoney(g.net, { zeroDash: false }))}</td></tr>`;
    })
    .join("");

  const positions = d.cashPositions.length
    ? d.cashPositions
        .map(
          (
            p,
          ) => `<tr><td class="code">${escHtml(p.code)}</td><td>${escHtml(p.name)}${p.bankLabel ? `<div class="sub">${escHtml(p.bankLabel)}</div>` : ""}</td>
  <td class="num">${escHtml(fmtMoney(p.balance))}</td></tr>`,
        )
        .join("")
    : emptyRow(3, "Belum ada akun kas/bank bersaldo");

  return `<section class="report-section">
${sectionHead(4, "Laporan Arus Kas", meta.periodLabel)}
<p class="lede">Metode langsung — mutasi akun kas &amp; bank dikelompokkan menurut akun lawan.</p>
<table class="fin">
  <colgroup><col style="width:9%"/><col/><col style="width:18%"/><col style="width:18%"/><col style="width:18%"/></colgroup>
  <thead><tr><th>Kode</th><th>Akun lawan</th><th class="num">Kas masuk</th><th class="num">Kas keluar</th><th class="num">Bersih</th></tr></thead>
  <tbody>
    ${groups || emptyRow(5)}
    <tr class="total"><td></td><td>Kenaikan (penurunan) kas bersih</td>
      <td class="num">${escHtml(fmtMoney(cf.totalInflow, { zeroDash: false }))}</td><td class="num">${escHtml(fmtMoney(cf.totalOutflow, { zeroDash: false }))}</td><td class="num">${escHtml(fmtMoney(cf.netCash, { zeroDash: false }))}</td></tr>
  </tbody>
</table>

<div class="block">
<h3>Posisi kas &amp; bank <span class="h3-cap">per ${escHtml(fmtDateUtc(meta.effectiveToIso))}</span></h3>
<table class="fin">
  <colgroup><col style="width:9%"/><col/><col style="width:22%"/></colgroup>
  <thead><tr><th>Kode</th><th>Akun</th><th class="num">Saldo</th></tr></thead>
  <tbody>
    ${positions}
    <tr class="total"><td></td><td>Total kas &amp; bank</td><td class="num">${escHtml(fmtMoney(d.kpis.cashAndBank, { zeroDash: false }))}</td></tr>
  </tbody>
</table>
</div>
</section>`;
}

function brandPnl(d: MonthlyReportData, no: number): string {
  const rows = d.brandPnl.length
    ? d.brandPnl
        .map(
          (b) => `<tr><td>${escHtml(b.name)}</td>
  <td class="num">${escHtml(fmtMoney(b.revenue))}</td><td class="num">${escHtml(fmtMoney(b.expense))}</td>
  <td class="num${num(b.net) < 0 ? " neg" : ""}">${escHtml(fmtMoney(b.net))}</td>
  <td class="num">${escHtml(b.marginPct == null ? EN_DASH : `${b.marginPct < 0 ? "−" : ""}${fmtPct(b.marginPct)}`)}</td></tr>`,
        )
        .join("")
    : emptyRow(5);
  const withRevenue = d.brandPnl.filter((b) => num(b.revenue) > 0);
  const chart =
    withRevenue.length >= 2
      ? `<figure class="figure"><figcaption><strong>Pendapatan per brand</strong></figcaption>
  ${htmlBarList(withRevenue.map((b) => ({ label: b.name, value: b.revenue })))}</figure>`
      : "";
  return `<section class="report-section flow keep">
${sectionHead(no, "Laba Rugi per Brand", d.meta.periodLabel)}
<table class="fin">
  <colgroup><col/><col style="width:19%"/><col style="width:19%"/><col style="width:19%"/><col style="width:11%"/></colgroup>
  <thead><tr><th>Brand</th><th class="num">Pendapatan</th><th class="num">Beban</th><th class="num">Laba (rugi)</th><th class="num">Margin</th></tr></thead>
  <tbody>
    ${rows}
    <tr class="total"><td>Total</td>
      <td class="num">${escHtml(fmtMoney(d.profitLoss.revenue.current, { zeroDash: false }))}</td>
      <td class="num">${escHtml(fmtMoney(d.profitLoss.expense.current, { zeroDash: false }))}</td>
      <td class="num">${escHtml(fmtMoney(d.profitLoss.netIncome.current, { zeroDash: false }))}</td>
      <td class="num">${escHtml(d.kpis.marginPct == null ? EN_DASH : `${d.kpis.marginPct < 0 ? "−" : ""}${fmtPct(d.kpis.marginPct)}`)}</td></tr>
  </tbody>
</table>
${chart}
</section>`;
}

function budget(d: MonthlyReportData, no: number): string {
  const rows = d.budget.rows.length
    ? d.budget.rows
        .map(
          (
            b,
          ) => `<tr><td>${escHtml(b.label)}${b.over ? ` <span class="tag tag-neg">Terlampaui</span>` : ""}</td>
  <td class="num">${escHtml(fmtMoney(b.limit))}</td><td class="num">${escHtml(fmtMoney(b.actual))}</td>
  <td class="num${b.over ? " neg" : ""}">${escHtml(fmtMoney(b.variance))}</td>
  <td class="meter-cell">${htmlBudgetMeter(b.usedPct, b.over)}</td>
  <td class="num">${escHtml(b.usedPct == null ? EN_DASH : fmtPct(b.usedPct))}</td></tr>`,
        )
        .join("")
    : emptyRow(6, "Belum ada anggaran yang ditetapkan untuk bulan ini");
  return `<section class="report-section flow">
${sectionHead(no, "Anggaran vs Realisasi", d.meta.periodLabel)}
${d.meta.brand ? scopeTag("Cakupan: seluruh perusahaan — anggaran tidak mengikuti filter brand laporan ini.") : ""}
<table class="fin">
  <colgroup><col/><col style="width:16%"/><col style="width:16%"/><col style="width:16%"/><col style="width:16%"/><col style="width:9%"/></colgroup>
  <thead><tr><th>Pos anggaran</th><th class="num">Anggaran</th><th class="num">Realisasi</th><th class="num">Sisa (lebih)</th><th>Terpakai</th><th class="num">%</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</section>`;
}

function agingBlock(
  title: string,
  partyLabel: string,
  side: AgingSide,
): string {
  const b = side.buckets;
  const docs = side.top.length
    ? side.top
        .map(
          (
            doc,
          ) => `<tr><td>${escHtml(doc.name)}${doc.docNumber ? `<div class="sub">${escHtml(doc.docNumber)}</div>` : ""}</td>
  <td>${escHtml(fmtDateUtc(doc.dueDateIso))}</td>
  <td>${doc.daysOverdue > 0 ? `<span class="tag tag-neg">Telat ${doc.daysOverdue} hari</span>` : `<span class="tag">Belum jatuh tempo</span>`}</td>
  <td class="num">${escHtml(fmtMoney(doc.remaining))}</td></tr>`,
        )
        .join("")
    : emptyRow(4, "Tidak ada dokumen terbuka");
  const more =
    side.count > side.top.length
      ? `<p class="scope">Menampilkan ${side.top.length} dari ${side.count} dokumen terbuka (paling telat lebih dulu).</p>`
      : "";
  return `<div class="block">
<h3>${escHtml(title)} <span class="h3-cap">${side.count} dokumen terbuka · ${side.overdueCount} lewat jatuh tempo</span></h3>
<table class="fin buckets">
  <thead><tr><th class="num">Belum jatuh tempo</th><th class="num">1–30 hari</th><th class="num">31–60 hari</th><th class="num">&gt; 60 hari</th><th class="num">Total</th></tr></thead>
  <tbody><tr class="total"><td class="num">${escHtml(fmtMoney(b.current))}</td><td class="num">${escHtml(fmtMoney(b.d1_30))}</td><td class="num">${escHtml(fmtMoney(b.d31_60))}</td><td class="num">${escHtml(fmtMoney(b.over60))}</td><td class="num">${escHtml(fmtMoney(side.total, { zeroDash: false }))}</td></tr></tbody>
</table>
<table class="fin">
  <colgroup><col/><col style="width:17%"/><col style="width:22%"/><col style="width:20%"/></colgroup>
  <thead><tr><th>${escHtml(partyLabel)}</th><th>Jatuh tempo</th><th>Status</th><th class="num">Sisa tagihan</th></tr></thead>
  <tbody>${docs}</tbody>
</table>
${more}
</div>`;
}

function aging(d: MonthlyReportData, no: number): string {
  return `<section class="report-section">
${sectionHead(no, "Umur Piutang & Hutang", `Posisi per ${fmtDateUtc(d.aging.refDateIso)}`)}
${scopeTag("Cakupan: seluruh perusahaan. Posisi dihitung per tanggal cetak (bukan akhir periode), sehingga dapat berbeda dari saldo piutang/hutang di neraca.")}
${agingBlock("Piutang usaha (AR)", "Pelanggan", d.aging.ar)}
${agingBlock("Hutang usaha (AP)", "Vendor", d.aging.ap)}
</section>`;
}

function tax(d: MonthlyReportData, no: number): string {
  const rows = d.tax.length
    ? d.tax
        .map(
          (t) =>
            `<tr><td class="code">${escHtml(t.code)}</td><td>${escHtml(t.label)}</td><td class="num">${escHtml(fmtMoney(t.amount))}</td></tr>`,
        )
        .join("")
    : emptyRow(3);
  return `<section class="report-section flow keep">
${sectionHead(no, "Rekap Pajak", d.meta.periodLabel)}
<table class="fin">
  <colgroup><col style="width:9%"/><col/><col style="width:22%"/></colgroup>
  <thead><tr><th>Kode</th><th>Pos</th><th class="num">Mutasi periode</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</section>`;
}

function notes(d: MonthlyReportData, no: number): string {
  const { meta } = d;
  const items = [
    "Laporan disusun dari jurnal berstatus POSTED dalam mata uang dasar Rupiah (IDR); nominal dibulatkan ke rupiah terdekat, angka negatif ditulis dalam kurung.",
    `Pembanding laba rugi adalah bulan kalender ${meta.prevPeriodLabel}; pembanding neraca adalah posisi akhir bulan tersebut.`,
    meta.isInProgress
      ? `Bulan masih berjalan: data mencakup transaksi s.d. ${fmtDateUtc(meta.effectiveToIso)}.`
      : `Periode mencakup ${fmtDateUtc(meta.fromIso)} s.d. ${fmtDateUtc(meta.toIso)}.`,
    `${meta.postedJournalCount} jurnal terposting pada periode ini.${meta.draftJournalCount > 0 ? ` ${meta.draftJournalCount} jurnal draft TIDAK termasuk dalam laporan.` : " Tidak ada jurnal draft yang tertinggal."}`,
    meta.lock
      ? `Periode telah dikunci pada ${fmtDateTimeJakarta(meta.lock.lockedAtIso)}${meta.lock.lockedByName ? ` oleh ${meta.lock.lockedByName}` : ""} — angka bersifat final.`
      : "Periode belum dikunci — angka masih dapat berubah sampai tutup buku dilakukan.",
    "Arus kas memakai metode langsung yang disederhanakan (klasifikasi menurut akun lawan), bukan penyajian PSAK 2 lengkap.",
    ...(meta.brand
      ? [
          `Laporan difilter untuk brand ${meta.brand.name}: hanya baris jurnal bertag brand tersebut yang dihitung.`,
        ]
      : []),
  ];
  return `<section class="report-section flow keep">
${sectionHead(no, "Status Periode & Catatan", meta.periodLabel)}
<ol class="notes">${items.map((t) => `<li>${escHtml(t)}</li>`).join("")}</ol>
</section>`;
}

function signatures(d: MonthlyReportData, no: number): string {
  const slot = (role: string, name: string | null) => `<div class="sign">
  <div class="sign-role">${escHtml(role)}</div>
  <div class="sign-space"></div>
  <div class="sign-name">${name ? escHtml(name) : "&nbsp;"}</div>
  <div class="sign-meta">Tanggal: ____________</div>
</div>`;
  return `<section class="report-section flow keep">
${sectionHead(no, "Lembar Pengesahan", d.meta.periodLabel)}
<div class="sign-grid">
  ${slot("Disusun oleh", d.meta.generatedByName)}
  ${slot("Diperiksa oleh", null)}
  ${slot("Disetujui oleh", null)}
</div>
</section>`;
}

function trialBalance(d: MonthlyReportData): string {
  const tb = d.trialBalance;
  const groups = FINANCE_TYPE_GROUP_ORDER.map((type) => {
    const rows = tb.rows.filter((r) => r.type === type);
    if (rows.length === 0) return "";
    return `<tr class="group"><td colspan="4">${escHtml(FINANCE_TYPE_LABEL[type])}</td></tr>${rows
      .map(
        (r) =>
          `<tr><td class="code">${escHtml(r.code)}</td><td>${escHtml(r.name)}</td><td class="num">${escHtml(fmtMoney(r.debit))}</td><td class="num">${escHtml(fmtMoney(r.credit))}</td></tr>`,
      )
      .join("")}`;
  }).join("");
  const warn =
    !d.meta.brand && !tb.isBalanced
      ? `<div class="callout callout-neg"><strong>Neraca saldo tidak seimbang.</strong> Total debit berbeda dengan total kredit.</div>`
      : "";
  return `<section class="report-section">
${sectionHead("A", "Lampiran — Neraca Saldo", `Per ${fmtDateUtc(d.meta.effectiveToIso)}`)}
${warn}
<table class="fin compact">
  <colgroup><col style="width:10%"/><col/><col style="width:21%"/><col style="width:21%"/></colgroup>
  <thead><tr><th>Kode</th><th>Akun</th><th class="num">Debit</th><th class="num">Kredit</th></tr></thead>
  <tbody>
    ${groups || emptyRow(4, "Belum ada saldo")}
    <tr class="total"><td></td><td>Total</td><td class="num">${escHtml(fmtMoney(tb.totals.debit, { zeroDash: false }))}</td><td class="num">${escHtml(fmtMoney(tb.totals.credit, { zeroDash: false }))}</td></tr>
  </tbody>
</table>
</section>`;
}

// ── Dokumen ────────────────────────────────────────────────────────────────

function styles(d: MonthlyReportData): string {
  const footLeft = cssString(
    `Laporan Keuangan Bulanan · ${d.meta.periodLabel}${d.meta.brand ? ` · ${d.meta.brand.name}` : ""} · Rahasia`,
  );
  const footCenter = d.meta.lock
    ? `""`
    : cssString("DRAFT — periode belum dikunci");
  return `
@page {
  size: A4; margin: 18mm 16mm 20mm;
  @bottom-left { content: ${footLeft}; font: 7.5pt system-ui, "Segoe UI", Arial, sans-serif; color: #64748b; }
  @bottom-center { content: ${footCenter}; font: 700 7.5pt system-ui, "Segoe UI", Arial, sans-serif; color: #b45309; }
  @bottom-right { content: "Halaman " counter(page) " dari " counter(pages); font: 7.5pt system-ui, "Segoe UI", Arial, sans-serif; color: #64748b; }
}
@page :first { margin: 0; @bottom-left { content: none } @bottom-center { content: none } @bottom-right { content: none } }
:root { --ink:#0f172a; --muted:#64748b; --rule:#e2e8f0; --fill:#f1f5f9; --accent:#0f3d5e; --pos:#047857; --neg:#b91c1c; --warn:#b45309; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", "DejaVu Sans", sans-serif; color: var(--ink); font-size: 10pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, h3, p { margin: 0; }
.muted { color: var(--muted); }

/* Cover */
.cover { height: 297mm; padding: 22mm 22mm 20mm; background: var(--accent); color: #fff; display: flex; flex-direction: column; break-after: page; position: relative; overflow: hidden; }
.cover::after { content: ""; position: absolute; right: -60mm; bottom: -60mm; width: 170mm; height: 170mm; border-radius: 50%; border: 22mm solid rgba(255,255,255,.05); }
.cover-top { display: flex; align-items: center; gap: 4mm; font-size: 10pt; font-weight: 600; letter-spacing: .02em; }
.cover-logo { height: 11mm; width: auto; max-width: 40mm; object-fit: contain; }
.cover-conf { margin-left: auto; font-size: 7.5pt; letter-spacing: .16em; border: 1px solid rgba(255,255,255,.45); padding: 1.2mm 3mm; border-radius: 99px; }
.cover-main { margin-top: 62mm; position: relative; z-index: 1; }
.cover-kicker { font-size: 12pt; letter-spacing: .22em; text-transform: uppercase; color: rgba(255,255,255,.72); }
.cover h1 { font-size: 44pt; line-height: 1.08; font-weight: 700; margin-top: 5mm; letter-spacing: -.01em; }
.cover-rule { width: 26mm; height: 1.4mm; background: #e9b44c; margin: 9mm 0 7mm; }
.cover-scope { font-size: 14pt; font-weight: 600; }
.cover-range { font-size: 10.5pt; color: rgba(255,255,255,.75); margin-top: 1.5mm; }
.cover-status { margin-top: 9mm; display: flex; align-items: center; gap: 3mm; }
.cover .badge-note { color: rgba(255,255,255,.8); }
.cover-foot { margin-top: auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; border-top: 1px solid rgba(255,255,255,.25); padding-top: 5mm; font-size: 9.5pt; position: relative; z-index: 1; }
.cf-label { display: block; font-size: 7.5pt; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.6); margin-bottom: 1mm; }

/* Badge & chip */
.badge { display: inline-block; font-size: 8pt; font-weight: 700; letter-spacing: .12em; padding: 1mm 3mm; border-radius: 99px; }
.badge-final { background: #d1fae5; color: #065f46; }
.badge-draft { background: #fef3c7; color: #92400e; }
.badge-note { font-size: 8.5pt; color: var(--muted); }
.status-strip { display: flex; align-items: center; gap: 3mm; margin-bottom: 5mm; }
.chip { display: inline-flex; align-items: center; gap: 1mm; font-size: 7.5pt; font-weight: 600; padding: .7mm 2.2mm; border-radius: 99px; white-space: nowrap; }
.chip-vs { font-weight: 400; opacity: .85; }
.chip-pos { background: #d1fae5; color: #065f46; } .chip-neg { background: #fee2e2; color: #991b1b; } .chip-info { background: var(--fill); color: #475569; }
.arrow { width: 2mm; height: 2mm; }
.tag { display: inline-block; font-size: 7.5pt; padding: .3mm 1.8mm; border-radius: 99px; background: var(--fill); color: #475569; white-space: nowrap; }
.tag-neg { background: #fee2e2; color: #991b1b; font-weight: 600; }

/* Section */
.report-section { break-before: page; }
.report-section.flow { break-before: auto; margin-top: 11mm; }
.report-section.keep { break-inside: avoid; }
.sec-head { display: flex; align-items: baseline; gap: 3mm; border-bottom: 2px solid var(--accent); padding-bottom: 2.2mm; margin-bottom: 5mm; break-after: avoid; }
.sec-no { font-size: 9pt; font-weight: 700; color: #fff; background: var(--accent); border-radius: 1mm; padding: .4mm 2mm; position: relative; top: -.4mm; }
.sec-head h2 { font-size: 15pt; font-weight: 700; letter-spacing: -.005em; }
.sec-cap { margin-left: auto; font-size: 8.5pt; color: var(--muted); }
h3 { font-size: 11pt; font-weight: 700; margin: 0 0 2.5mm; break-after: avoid; }
.h3-cap { font-size: 8.5pt; font-weight: 400; color: var(--muted); margin-left: 2mm; }
.block { margin-top: 8mm; }
.lede, .scope { font-size: 8.5pt; color: var(--muted); margin-bottom: 3mm; }
.check-ok { font-size: 8.5pt; color: var(--pos); margin-bottom: 3mm; font-weight: 600; }
.callout { border-radius: 1.5mm; padding: 3mm 4mm; font-size: 9pt; margin-bottom: 4mm; break-inside: avoid; }
.callout-neg { background: #fef2f2; border: 1px solid #fecaca; color: #7f1d1d; }

/* KPI */
.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3.5mm; }
.kpi { border: 1px solid var(--rule); border-top: 1mm solid var(--accent); border-radius: 1.5mm; padding: 3.5mm 4mm; break-inside: avoid; }
.kpi-label { font-size: 7.5pt; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
.kpi-value { font-size: 17pt; font-weight: 700; line-height: 1.2; margin-top: 1mm; font-variant-numeric: tabular-nums; }
.kpi-full { font-size: 8pt; color: var(--muted); font-variant-numeric: tabular-nums; }
.kpi-chip { margin-top: 2.2mm; }

/* Sorotan */
.highlights { margin-top: 6mm; border: 1px solid var(--rule); border-left: 1.2mm solid #e9b44c; border-radius: 1.5mm; padding: 4mm 5mm; break-inside: avoid; }
.highlights ul { list-style: none; margin: 0; padding: 0; }
.hl { display: flex; gap: 2.5mm; align-items: baseline; font-size: 9.5pt; padding: .9mm 0; }
.hl-dot { flex: none; width: 2mm; height: 2mm; border-radius: 50%; background: var(--muted); position: relative; top: -.2mm; }
.hl-positive .hl-dot { background: var(--pos); } .hl-negative .hl-dot { background: var(--neg); } .hl-warning .hl-dot { background: #f59e0b; }
.hl-warning { font-weight: 600; }

/* Figure */
.figure { margin: 7mm 0 0; break-inside: avoid; }
figcaption { font-size: 9pt; color: var(--muted); margin-bottom: 2.5mm; }
figcaption strong { color: var(--ink); }
.chart-empty { border: 1px dashed var(--rule); border-radius: 1.5mm; padding: 9mm; text-align: center; font-size: 9pt; color: var(--muted); }
.hbar-row { display: grid; grid-template-columns: 34% 1fr 27%; gap: 3mm; align-items: center; padding: 1.2mm 0; font-size: 9pt; }
.hbar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hbar-track { height: 3.2mm; background: ${CHART_COLORS.track}; border-radius: 1mm; overflow: hidden; }
.hbar-fill { display: block; height: 100%; border-radius: 0 1mm 1mm 0; }
.hbar-value { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.hbar-cap { color: var(--muted); margin-left: 2mm; font-size: 8pt; }
.meter { position: relative; height: 2.6mm; background: ${CHART_COLORS.track}; border-radius: 1mm; }
.meter-fill { display: block; height: 100%; border-radius: 1mm; }
.meter-mark { position: absolute; top: -1mm; bottom: -1mm; width: 0; border-left: 1.5px solid var(--ink); }
.meter-cell { vertical-align: middle; }

/* Tabel keuangan */
table.fin { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9.5pt; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
table.fin + table.fin { margin-top: 3mm; }
table.fin thead { display: table-header-group; }
table.fin th { text-align: left; font-size: 7.5pt; letter-spacing: .08em; text-transform: uppercase; color: #475569; font-weight: 700; background: var(--fill); padding: 2mm 2.2mm; border-bottom: 1px solid #cbd5e1; }
table.fin td { padding: 1.5mm 2.2mm; border-bottom: 1px solid var(--rule); vertical-align: top; overflow-wrap: anywhere; }
table.fin tr { break-inside: avoid; }
table.fin .num { text-align: right; white-space: nowrap; }
table.fin td.code { color: var(--muted); font-size: 8.5pt; }
table.fin .sub { font-size: 8pt; color: var(--muted); }
table.fin tr.group td { font-size: 8pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); padding-top: 3.5mm; border-bottom: 1px solid #cbd5e1; break-after: avoid; }
table.fin tr.subtotal td { font-weight: 600; border-top: 1px solid var(--ink); border-bottom: none; }
table.fin tr.total td { font-weight: 700; border-top: 1px solid var(--ink); border-bottom: 3px double var(--ink); background: #f8fafc; }
table.fin tr.empty td { text-align: center; color: var(--muted); font-style: italic; padding: 4mm; }
table.fin td.pos { color: var(--pos); } table.fin td.neg { color: var(--neg); }
table.fin.compact { font-size: 8.5pt; } table.fin.compact td { padding: 1.1mm 2.2mm; }
table.fin.buckets tr.total td { background: none; border-top: none; }

/* Catatan & pengesahan */
.notes { margin: 0; padding-left: 5mm; font-size: 9.5pt; }
.notes li { margin-bottom: 1.6mm; padding-left: 1mm; }
.sign-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; margin-top: 2mm; }
.sign-role { font-size: 8pt; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
.sign-space { height: 24mm; border-bottom: 1px solid var(--ink); }
.sign-name { font-weight: 600; margin-top: 1.5mm; font-size: 9.5pt; }
.sign-meta { font-size: 8.5pt; color: var(--muted); margin-top: .8mm; }
`;
}

/** Dokumen HTML mandiri (tanpa JS & aset eksternal) untuk `renderHtmlToPdfBuffer`. */
export function buildMonthlyReportHtml(d: MonthlyReportData): string {
  const title = `Laporan Keuangan Bulanan — ${d.meta.periodLabel}${d.meta.brand ? ` — ${d.meta.brand.name}` : ""}`;
  // Nomor bagian dinamis: L/R per brand dilewati bila laporan difilter brand.
  let no = 4;
  const next = () => (no += 1);
  const body = [
    cover(d),
    summary(d),
    profitLoss(d),
    balanceSheet(d),
    cashFlow(d),
    d.meta.brand ? "" : brandPnl(d, next()),
    budget(d, next()),
    aging(d, next()),
    tax(d, next()),
    notes(d, next()),
    signatures(d, next()),
    trialBalance(d),
  ].join("\n");

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escHtml(title)}</title>
<style>${styles(d)}</style>
</head>
<body>
${body}
</body>
</html>`;
}
