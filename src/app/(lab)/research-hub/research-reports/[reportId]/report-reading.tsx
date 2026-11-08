import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  REPORT_BODY_HTML_CLASS,
  type ReportSectionRow,
} from "@/components/research-hub/report-section-list";
import { reportBodyToHtml } from "@/lib/research/reports/report-body-html";
import { cn } from "@/lib/utils";

/**
 * Tipografi baca laporan: teks utama (bukan muted), 15px, leading longgar,
 * lebar baris maksimal ~72 karakter.
 */
export const REPORT_PROSE_CLASS = cn(
  REPORT_BODY_HTML_CLASS,
  "text-foreground/90 max-w-[72ch] text-[15px] leading-7 [&_p]:mb-3 [&_li]:mb-2 [&_h3]:mt-5 [&_h3]:mb-1.5",
);

const MODULE_LABELS: Record<string, string> = {
  reviewIntel: "Review Intel",
  competitor: "Competitor",
  trendRadar: "Trend Radar",
  keywordIntel: "Keyword Intel",
  socialListening: "Social Listening",
  uspAnalyzer: "USP Analyzer",
  conceptLab: "Concept Lab",
};

function sectionAnchor(section: ReportSectionRow, index: number) {
  return `bagian-${index + 1}-${section.id}`.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Isi laporan sebagai dokumen: daftar isi + bagian-bagian dengan heading jelas. */
export function ReportDocument({ sections }: { sections: ReportSectionRow[] }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
      {sections.length > 2 ? (
        <nav aria-label="Daftar isi" className="lg:sticky lg:top-28 lg:self-start">
          <p className="rh-meta mb-2">Daftar isi</p>
          <ol className="border-border flex flex-col gap-1 border-l">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${sectionAnchor(section, index)}`}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-px block border-l border-transparent py-1 pl-3 text-sm leading-snug transition-colors hover:border-foreground focus-visible:ring-2 focus-visible:outline-none"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : (
        <div className="hidden lg:block" />
      )}

      <div className="flex flex-col gap-10">
        {sections.map((section, index) => (
          <article
            key={section.id}
            id={sectionAnchor(section, index)}
            aria-labelledby={`${sectionAnchor(section, index)}-title`}
            className="scroll-mt-28"
          >
            <header className="mb-3 max-w-[72ch] space-y-0.5">
              <h2 id={`${sectionAnchor(section, index)}-title`} className="text-foreground text-lg font-semibold tracking-tight">
                {section.title}
              </h2>
              {section.moduleRef ? (
                <p className="rh-meta">
                  Sumber: {MODULE_LABELS[section.moduleRef] ?? section.moduleRef}
                </p>
              ) : null}
            </header>
            <div
              className={REPORT_PROSE_CLASS}
              dangerouslySetInnerHTML={{ __html: reportBodyToHtml(section.body) }}
            />
          </article>
        ))}
      </div>
    </div>
  );
}

export type ReportActionItem = {
  module: string;
  owner: string;
  priority: string;
  action: string;
  rationale: string;
  sourceLabel: string | null;
  href: string | null;
  evidence?: { label: string; refId?: string }[];
  confidence?: number;
  recommendationId?: string;
};

const PRIORITY_CLASS: Record<string, string> = {
  P0: "text-rose-700 dark:text-rose-300",
  P1: "text-amber-700 dark:text-amber-300",
  P2: "text-muted-foreground",
};

/** Daftar rekomendasi aksi: prioritas, aksi, alasan, bukti, pemilik. */
export function ReportActionList({ items }: { items: ReportActionItem[] }) {
  return (
    <ol className="divide-border border-border flex max-w-[80ch] flex-col divide-y border-y">
      {items.map((item, i) => (
        <li key={item.recommendationId ?? i} className="flex items-start gap-4 py-4">
          <span
            className={cn(
              "rh-num w-8 shrink-0 pt-0.5 text-sm font-semibold",
              PRIORITY_CLASS[item.priority] ?? "text-muted-foreground",
            )}
          >
            {item.priority}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="text-foreground text-[15px] leading-snug font-medium">
              {item.href ? (
                <Link
                  href={item.href}
                  className="focus-visible:ring-ring inline-flex items-start gap-1 rounded hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {item.action}
                  <ArrowUpRight className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
                </Link>
              ) : (
                item.action
              )}
            </h3>
            {item.rationale ? (
              <p className="text-muted-foreground max-w-[72ch] text-sm leading-relaxed">{item.rationale}</p>
            ) : null}
            {item.evidence && item.evidence.length > 0 ? (
              <ul aria-label="Bukti" className="flex flex-wrap gap-1.5">
                {item.evidence.map((e, j) => (
                  <li key={j} className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs">
                    {e.label}
                  </li>
                ))}
              </ul>
            ) : null}
            <dl className="rh-meta flex flex-wrap gap-x-4 gap-y-0.5">
              <div className="flex gap-1">
                <dt>Pemilik:</dt>
                <dd className="text-foreground">{item.owner}</dd>
              </div>
              {item.sourceLabel ? (
                <div className="flex gap-1">
                  <dt>Sumber:</dt>
                  <dd className="text-foreground">{item.sourceLabel}</dd>
                </div>
              ) : null}
              {typeof item.confidence === "number" ? (
                <div className="flex gap-1">
                  <dt>Estimasi keyakinan AI:</dt>
                  <dd className="rh-num text-foreground">{Math.round(item.confidence * 100)}%</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </li>
      ))}
    </ol>
  );
}
