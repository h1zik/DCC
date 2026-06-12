import { cn } from "@/lib/utils";

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
    <div className="space-y-8">
      {sections.map((section) => (
        <article key={section.id} className="border-border/60 border-b pb-6 last:border-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{section.title}</h2>
            {section.moduleRef ? (
              <span
                className={cn(
                  "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                )}
              >
                {MODULE_LABELS[section.moduleRef] ?? section.moduleRef}
              </span>
            ) : null}
          </div>
          <div className="text-muted-foreground space-y-2 text-sm leading-relaxed whitespace-pre-wrap">
            {section.body}
          </div>
        </article>
      ))}
    </div>
  );
}
