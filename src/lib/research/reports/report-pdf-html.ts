import type { ReportSection } from "@/lib/research/reports/types";
import { esc, reportBodyToHtml } from "@/lib/research/reports/report-body-html";

export type ReportPdfActionItem = {
  priority: string;
  owner: string;
  action: string;
  rationale: string;
  sourceLabel: string | null;
};

export type ReportPdfMetrics = Record<string, number>;

const METRIC_LABELS: Record<string, string> = {
  reviewSourcesReady: "Review Intel",
  competitorsTracked: "Kompetitor",
  trendDigests: "Trend Digest",
  keywordQueries: "Keyword",
  socialBatches: "Social Batch",
  uspAnalyses: "USP & Gap",
  productConcepts: "Konsep",
};

function metricsToHtml(metrics?: ReportPdfMetrics): string {
  if (!metrics) return "";
  const entries = Object.entries(metrics).filter(([, v]) => typeof v === "number");
  if (entries.length === 0) return "";
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const bars = entries
    .map(([key, value]) => {
      const pct = Math.round((value / max) * 100);
      return `<div class="bar-row">
        <span class="bar-label">${esc(METRIC_LABELS[key] ?? key)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
        <span class="bar-value">${value}</span>
      </div>`;
    })
    .join("");
  return `<section data-pdf-block><h2>Aktivitas Modul</h2><div class="bars">${bars}</div></section>`;
}

function actionItemsToHtml(items?: ReportPdfActionItem[]): string {
  if (!items || items.length === 0) return "";
  const rows = items
    .map(
      (a) => `<tr>
      <td><span class="prio prio-${esc(a.priority)}">${esc(a.priority)}</span></td>
      <td>${esc(a.owner)}</td>
      <td><strong>${esc(a.action)}</strong><br/><span class="muted">${esc(a.rationale)}</span></td>
      <td class="muted">${esc(a.sourceLabel ?? "")}</td>
    </tr>`,
    )
    .join("");
  return `<section data-pdf-block><h2>Rekomendasi Aksi Lintas-Modul</h2>
    <table class="actions">
      <thead><tr><th>Prio</th><th>Owner</th><th>Aksi</th><th>Sumber</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

export function buildReportPdfHtml(input: {
  title: string;
  aiSummary: string | null;
  sections: ReportSection[];
  actionItems?: ReportPdfActionItem[];
  metrics?: ReportPdfMetrics;
  periodStart?: string | null;
  periodEnd?: string | null;
}): string {
  const period =
    input.periodStart && input.periodEnd
      ? `${input.periodStart} — ${input.periodEnd}`
      : "";

  const sectionsHtml = input.sections
    .map(
      (s) => `
    <section data-pdf-block>
      <h2>${esc(s.title)}${s.moduleRef ? ` <span class="badge">${esc(s.moduleRef)}</span>` : ""}</h2>
      <div class="body">${reportBodyToHtml(s.body)}</div>
    </section>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${esc(input.title)}</title>
  <style>
    @page { margin: 36pt; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; line-height: 1.6; padding: 40px; max-width: 714px; margin: 0; font-size: 14px; }
    h1 { font-size: 22px; margin: 0 0 8px; line-height: 1.3; }
    .meta { color: #666; font-size: 13px; margin: 0 0 16px; }
    h2 { font-size: 16px; margin: 0 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 6px; line-height: 1.35; }
    section[data-pdf-block] { margin: 0 0 24px; padding: 0 0 14px; overflow: visible; }
    h3 { font-size: 14px; margin: 12px 0 6px; line-height: 1.4; }
    .summary { background: #f4f4f5; padding: 12px 16px; border-radius: 8px; }
    .badge { font-size: 10px; background: #e4e4e7; padding: 2px 6px; border-radius: 4px; font-weight: normal; }
    .body p { margin: 0 0 8px; line-height: 1.6; }
    .body strong { font-weight: 600; }
    .body ul {
      margin: 0;
      padding: 0 0 0 1.35em;
      list-style-type: disc;
      list-style-position: outside;
    }
    .body li {
      display: list-item;
      margin: 0 0 6px;
      line-height: 1.65;
      padding-left: 0.15em;
    }
    .bars { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
    .bar-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .bar-label { width: 110px; color: #444; }
    .bar-track { flex: 1; background: #f0f0f1; border-radius: 4px; height: 12px; overflow: hidden; }
    .bar-fill { display: block; height: 100%; background: #6366f1; }
    .bar-value { width: 32px; text-align: right; font-variant-numeric: tabular-nums; }
    table.actions { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    table.actions th, table.actions td { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; vertical-align: top; }
    .muted { color: #777; }
    .prio { font-weight: bold; padding: 1px 6px; border-radius: 4px; font-size: 10px; }
    .prio-P0 { background: #fee2e2; color: #b91c1c; }
    .prio-P1 { background: #fef3c7; color: #b45309; }
    .prio-P2 { background: #e2e8f0; color: #475569; }
  </style>
</head>
<body>
  <section data-pdf-block>
    <h1>${esc(input.title)}</h1>
    <p class="meta">${period ? `Periode: ${esc(period)} · ` : ""}DCC Research Hub</p>
  </section>
  ${input.aiSummary ? `<section data-pdf-block class="summary"><strong>Executive Summary</strong><div class="body">${reportBodyToHtml(input.aiSummary)}</div></section>` : ""}
  ${metricsToHtml(input.metrics)}
  ${actionItemsToHtml(input.actionItems)}
  ${sectionsHtml}
</body>
</html>`;
}
