import type { ReportSection } from "@/lib/research/reports/types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function bodyToHtml(body: string): string {
  return body
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return "<br/>";
      if (t.startsWith("- ") || t.startsWith("* ")) {
        return `<li>${esc(t.slice(2))}</li>`;
      }
      if (t.startsWith("## ")) {
        return `<h3>${esc(t.slice(3))}</h3>`;
      }
      return `<p>${esc(t)}</p>`;
    })
    .join("\n");
}

export function buildReportPdfHtml(input: {
  title: string;
  aiSummary: string | null;
  sections: ReportSection[];
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
    <section>
      <h2>${esc(s.title)}${s.moduleRef ? ` <span class="badge">${esc(s.moduleRef)}</span>` : ""}</h2>
      <div class="body">${bodyToHtml(s.body)}</div>
    </section>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${esc(input.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #111; line-height: 1.55; padding: 32px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
    h2 { font-size: 16px; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    h3 { font-size: 14px; margin-top: 12px; }
    .summary { background: #f4f4f5; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
    .badge { font-size: 10px; background: #e4e4e7; padding: 2px 6px; border-radius: 4px; font-weight: normal; }
    .body p { margin: 6px 0; }
    .body li { margin: 4px 0; }
  </style>
</head>
<body>
  <h1>${esc(input.title)}</h1>
  <p class="meta">${period ? `Periode: ${esc(period)} · ` : ""}DCC Research Hub</p>
  ${input.aiSummary ? `<div class="summary"><strong>Executive Summary</strong><p>${esc(input.aiSummary)}</p></div>` : ""}
  ${sectionsHtml}
</body>
</html>`;
}
