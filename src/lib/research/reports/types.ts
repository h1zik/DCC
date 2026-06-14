import "server-only";

export type ReportSection = {
  id: string;
  title: string;
  body: string;
  moduleRef?: string;
};

export type ReportConfig = {
  notify?: boolean;
  modules?: {
    reviewIntel?: boolean;
    competitor?: boolean;
    trendRadar?: boolean;
    keywordIntel?: boolean;
    socialListening?: boolean;
    conceptLab?: boolean;
    uspAnalyzer?: boolean;
  };
  category?: string;
  competitorId?: string;
  digestId?: string;
  dateRange?: { start: string; end: string };
  /** Specific source records per module; omit = use latest. */
  sources?: {
    reviewSourceId?: string;
    competitorId?: string;
    digestId?: string;
    keywordQueryId?: string;
    socialMonitorId?: string;
    uspAnalysisId?: string;
    conceptId?: string;
    productDiscoveryQueryId?: string;
  };
};

export function parseReportSections(raw: unknown): ReportSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is ReportSection =>
      typeof s === "object" &&
      s != null &&
      typeof (s as ReportSection).title === "string" &&
      typeof (s as ReportSection).body === "string",
  );
}
