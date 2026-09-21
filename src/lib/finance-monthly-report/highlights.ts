import { fmtMoney, fmtPct } from "./format";
import type { Highlight, MoneyPair, MonthlyReportData } from "./types";

const MAX_HIGHLIGHTS = 8;

type ReportNumbers = Omit<MonthlyReportData, "highlights">;

const rp = (value: string | number) =>
  fmtMoney(value, { withRp: true, zeroDash: false });
const num = (s: string) => Number(s) || 0;

/** "naik 12,4%" / "turun 3,0%" / "tidak berubah"; null bila tak ada pembanding. */
function movement(p: MoneyPair): string | null {
  if (p.deltaPct == null) return null;
  if (p.deltaPct === 0) return "tidak berubah";
  return `${p.deltaPct > 0 ? "naik" : "turun"} ${fmtPct(p.deltaPct)}`;
}

/**
 * Sorotan otomatis — murni berbasis aturan (deterministik, tanpa AI).
 * Urutan: peringatan integritas → kinerja → anggaran → piutang/hutang →
 * komposisi → catatan. Dibatasi `MAX_HIGHLIGHTS`.
 */
export function buildMonthlyHighlights(d: ReportNumbers): Highlight[] {
  const { meta, kpis } = d;
  const prev = meta.prevPeriodLabel;

  if (meta.postedJournalCount === 0) {
    return [
      {
        tone: "info",
        text: `Tidak ada jurnal terposting pada ${meta.periodLabel} — laporan ini hanya memuat saldo berjalan.`,
      },
    ];
  }

  const warnings: Highlight[] = [];
  const body: Highlight[] = [];
  const notes: Highlight[] = [];

  // ── Integritas ──────────────────────────────────────────────────────────
  // Neraca per brand adalah tampilan segmen — wajar bila tidak seimbang.
  if (!meta.brand && !d.balanceSheet.current.isBalanced) {
    warnings.push({
      tone: "warning",
      text: `Neraca tidak seimbang — selisih ${rp(d.balanceSheet.current.difference)}. Periksa jurnal sebelum laporan difinalkan.`,
    });
  }
  if (!meta.brand && !d.trialBalance.isBalanced) {
    warnings.push({
      tone: "warning",
      text: "Neraca saldo tidak seimbang: total debit berbeda dengan total kredit.",
    });
  }

  // ── Kinerja ─────────────────────────────────────────────────────────────
  // Pos yang nol di kedua bulan bukan berita — lewati.
  const hasActivity = (p: MoneyPair) =>
    num(p.current) !== 0 || num(p.previous) !== 0;

  const revMove = movement(kpis.revenue);
  if (hasActivity(kpis.revenue))
    body.push({
      tone:
        kpis.revenue.deltaPct == null || kpis.revenue.deltaPct === 0
          ? "info"
          : kpis.revenue.deltaPct > 0
            ? "positive"
            : "negative",
      text: revMove
        ? `Pendapatan ${rp(kpis.revenue.current)}, ${revMove} dibanding ${prev}.`
        : `Pendapatan ${rp(kpis.revenue.current)} — belum ada pembanding di ${prev}.`,
    });

  const expMove = movement(kpis.expense);
  if (hasActivity(kpis.expense))
    body.push({
      // Beban naik = negatif.
      tone:
        kpis.expense.deltaPct == null || kpis.expense.deltaPct === 0
          ? "info"
          : kpis.expense.deltaPct > 0
            ? "negative"
            : "positive",
      text: expMove
        ? `Beban ${rp(kpis.expense.current)}, ${expMove} dibanding ${prev}.`
        : `Beban ${rp(kpis.expense.current)} — belum ada pembanding di ${prev}.`,
    });

  const netCur = num(kpis.net.current);
  const netPrev = num(kpis.net.previous);
  if (!hasActivity(kpis.net)) {
    // Tidak ada hasil usaha untuk dilaporkan.
  } else if (netCur < 0 && netPrev > 0) {
    body.push({
      tone: "negative",
      text: `Hasil usaha berbalik rugi: rugi bersih ${rp(Math.abs(netCur))} setelah laba ${rp(netPrev)} di ${prev}.`,
    });
  } else if (netCur > 0 && netPrev < 0) {
    body.push({
      tone: "positive",
      text: `Hasil usaha berbalik laba: laba bersih ${rp(netCur)} setelah rugi ${rp(Math.abs(netPrev))} di ${prev}.`,
    });
  } else {
    const label = netCur < 0 ? "Rugi bersih" : "Laba bersih";
    const netMove = movement(kpis.net);
    body.push({
      tone: netCur < 0 ? "negative" : netCur > 0 ? "positive" : "info",
      text: netMove
        ? `${label} ${rp(Math.abs(netCur))}, ${netMove} dibanding ${prev}.`
        : `${label} ${rp(Math.abs(netCur))}.`,
    });
  }

  if (kpis.marginPct != null) {
    if (kpis.prevMarginPct != null) {
      const diff = kpis.marginPct - kpis.prevMarginPct;
      const dir = diff > 0 ? "naik" : diff < 0 ? "turun" : "tetap";
      body.push({
        tone: diff > 0 ? "positive" : diff < 0 ? "negative" : "info",
        text:
          dir === "tetap"
            ? `Margin bersih ${signedPct(kpis.marginPct)}, sama dengan ${prev}.`
            : `Margin bersih ${signedPct(kpis.marginPct)}, ${dir} ${fmtPct(diff).replace("%", "")} poin dari ${signedPct(kpis.prevMarginPct)}.`,
      });
    } else {
      body.push({
        tone: "info",
        text: `Margin bersih ${signedPct(kpis.marginPct)}.`,
      });
    }
  }

  // ── Anggaran ────────────────────────────────────────────────────────────
  if (d.budget.rows.length > 0) {
    if (d.budget.overCount > 0) {
      const worst = d.budget.rows
        .filter((r) => r.over)
        .sort((a, b) => num(a.variance) - num(b.variance))[0];
      warnings.push({
        tone: "warning",
        text: `${d.budget.overCount} pos anggaran terlampaui — terbesar: ${worst.label} (lebih ${rp(Math.abs(num(worst.variance)))}).`,
      });
    } else {
      body.push({
        tone: "positive",
        text: `Seluruh ${d.budget.rows.length} pos anggaran masih dalam batas.`,
      });
    }
  }

  // ── Piutang & hutang ────────────────────────────────────────────────────
  if (d.aging.ar.overdueCount > 0) {
    warnings.push({
      tone: "warning",
      text: `${d.aging.ar.overdueCount} piutang lewat jatuh tempo senilai ${rp(d.aging.ar.overdueTotal)} perlu ditagih.`,
    });
  }
  if (d.aging.ap.overdueCount > 0) {
    warnings.push({
      tone: "warning",
      text: `${d.aging.ap.overdueCount} hutang usaha lewat jatuh tempo senilai ${rp(d.aging.ap.overdueTotal)}.`,
    });
  }

  // ── Kas ─────────────────────────────────────────────────────────────────
  const cashNet = num(kpis.cashNet.current);
  if (cashNet < 0) {
    body.push({
      tone: "negative",
      text: `Arus kas bersih negatif ${rp(Math.abs(cashNet))}; saldo kas & bank akhir periode ${rp(kpis.cashAndBank)}.`,
    });
  } else if (cashNet > 0) {
    body.push({
      tone: "positive",
      text: `Arus kas bersih positif ${rp(cashNet)}; saldo kas & bank akhir periode ${rp(kpis.cashAndBank)}.`,
    });
  }

  // ── Komposisi ───────────────────────────────────────────────────────────
  const topExpense = d.topExpenses[0];
  if (topExpense) {
    body.push({
      tone: "info",
      text: `Beban terbesar: ${topExpense.name} ${rp(topExpense.amount)} (${fmtPct(topExpense.sharePct)} dari total beban).`,
    });
  }

  if (!meta.brand) {
    const ranked = d.brandPnl.filter(
      (b) => b.id != null && b.marginPct != null,
    );
    if (ranked.length >= 2) {
      const best = [...ranked].sort(
        (a, b) => (b.marginPct ?? 0) - (a.marginPct ?? 0),
      )[0];
      body.push({
        tone: "info",
        text: `Brand dengan margin terbaik: ${best.name} (${signedPct(best.marginPct ?? 0)}, laba ${rp(best.net)}).`,
      });
    }
  }

  const active = d.trend.filter(
    (t) => num(t.revenue) !== 0 || num(t.expense) !== 0,
  );
  if (active.length >= 3) {
    const best = [...active].sort((a, b) => num(b.net) - num(a.net))[0];
    const last = d.trend[d.trend.length - 1];
    if (best.year === last.year && best.month === last.month) {
      body.push({
        tone: "positive",
        text: `${meta.periodLabel} mencatat hasil bersih tertinggi dalam ${d.trend.length} bulan terakhir.`,
      });
    }
  }

  // ── Catatan ─────────────────────────────────────────────────────────────
  if (meta.draftJournalCount > 0) {
    notes.push({
      tone: "warning",
      text: `${meta.draftJournalCount} jurnal berstatus draft pada periode ini belum diposting dan tidak termasuk dalam laporan.`,
    });
  }
  if (meta.isInProgress) {
    notes.push({
      tone: "info",
      text: `Bulan masih berjalan — perbandingan dengan ${prev} (sebulan penuh) belum setara.`,
    });
  }

  // Catatan selalu ikut; isi tengah dipangkas bila melebihi batas.
  const room = Math.max(0, MAX_HIGHLIGHTS - warnings.length - notes.length);
  return [...warnings, ...body.slice(0, room), ...notes].slice(
    0,
    MAX_HIGHLIGHTS,
  );
}

function signedPct(p: number): string {
  return p < 0 ? `−${fmtPct(p)}` : fmtPct(p);
}
