import { reportBodyToHtml } from "@/lib/research/reports/report-body-html";

export const REPORT_BODY_HTML_CLASS =
  "text-muted-foreground text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1.5 [&_strong]:font-semibold [&_strong]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground";

export type ReportSectionRow = {
  id: string;
  title: string;
  body: string;
  moduleRef?: string;
};

const MODULE_LABELS: Record<string, string> = {
  reviewIntel: "Review Intel",
  competitor: "Competitor",
  trendRadar: "Trend Radar",
  keywordIntel: "Keyword Intel",
  socialListening: "Social Listening",
  uspAnalyzer: "USP Analyzer",
  conceptLab: "Concept Lab",
};

export function ReportSectionList({ sections }: { sections: ReportSectionRow[] }) {
  if (sections.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada section laporan.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, index) => (
        <article
          key={section.id}
          className="bento-tile animate-in fade-in slide-in-from-bottom-1 justify-start gap-3 duration-300 motion-reduce:animate-none"
          style={
            index > 0 && index < 8
              ? { animationDelay: `${index * 40}ms` }
              : undefined
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-foreground text-base font-bold tracking-tight">
              {section.title}
            </h2>
            {section.moduleRef ? (
              <span className="inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--lab-accent,var(--primary))]">
                {MODULE_LABELS[section.moduleRef] ?? section.moduleRef}
              </span>
            ) : null}
          </div>
          <div
            className={REPORT_BODY_HTML_CLASS}
            dangerouslySetInnerHTML={{ __html: reportBodyToHtml(section.body) }}
          />
        </article>
      ))}
    </div>
  );
}
