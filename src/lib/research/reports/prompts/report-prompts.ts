import "server-only";

import { ResearchReportType } from "@prisma/client";
import type { ReportAggregate } from "@/lib/research/reports/aggregate-report-data";

function baseInstruction(type: ResearchReportType): string {
  switch (type) {
    case "WEEKLY":
      return "Buat laporan riset mingguan ringkas untuk tim product & marketing beauty Indonesia.";
    case "CUSTOM":
      return "Buat laporan riset custom dari modul yang dipilih.";
    case "CATEGORY_DEEP_DIVE":
      return "Buat laporan deep dive komprehensif untuk satu kategori produk.";
    case "COMPETITOR_BATTLE":
      return "Buat competitor battle card satu halaman — perbandingan langsung vs kompetitor.";
    case "TREND_BRIEF":
      return "Buat trend brief untuk presentasi internal — fokus tren dan implikasi produk.";
    default:
      return "Buat laporan riset.";
  }
}

export function buildReportPrompt(input: {
  type: ResearchReportType;
  title: string;
  data: ReportAggregate;
  category?: string;
}): string {
  const actionItemsBlock =
    input.data.actionItems.length > 0
      ? `\nAction items lintas-modul (WAJIB rangkum & rujuk dalam satu section "Rekomendasi Aksi"):\n${input.data.actionItems
          .map(
            (a) =>
              `- [${a.priority}/${a.owner}] ${a.action} — ${a.rationale} (sumber: ${a.sourceLabel ?? a.module})`,
          )
          .join("\n")}`
      : "";

  return `${baseInstruction(input.type)}

Judul laporan: ${input.title}
${input.category ? `Kategori fokus: ${input.category}` : ""}
Periode: ${input.data.periodStart.toISOString().slice(0, 10)} s/d ${input.data.periodEnd.toISOString().slice(0, 10)}

Data agregat:
${JSON.stringify(input.data, null, 2)}
${actionItemsBlock}

Panduan:
- Jika ada uspDetail, buat section yang membahas gap matrix teratas + keputusan kategori (GO/WATCH/AVOID).
- Jika ada conceptDetail, ringkas konsep + keputusan validasi (GO/PIVOT/NO_GO).
- Selalu sertakan satu section "Rekomendasi Aksi" yang menyatukan action items lintas modul menjadi langkah konkret per owner.

Balas JSON:
{
  "aiSummary": "executive summary 3-4 kalimat",
  "sections": [
    {
      "id": "section-1",
      "title": "Judul section",
      "body": "Konten narasi markdown-style (paragraf + bullet jika perlu)",
      "moduleRef": "reviewIntel|competitor|trendRadar|keywordIntel|socialListening|uspAnalyzer|conceptLab|actionPlan"
    }
  ]
}

Minimal 4 sections, maksimal 10. Bahasa Indonesia profesional.`;
}
