import type { StoredContextModules } from "@/lib/research/usp-gap/context-types";
import type { UspGatheredContext } from "@/lib/research/usp-gap/gather-context";

export type ContextQualityAssessment = {
  coveragePct: number;
  notice: string | null;
  warnings: string[];
};

const MODULE_DEFS = [
  { toggle: "reviewIntel" as const, label: "Review Intel", resolved: "reviewIntel" as const },
  { toggle: "competitor" as const, label: "Competitor", resolved: "competitor" as const },
  { toggle: "trendRadar" as const, label: "Trend Radar", resolved: "trendRadar" as const },
  { toggle: "keywordIntel" as const, label: "Keyword Intel", resolved: "keywordIntel" as const },
  { toggle: "socialListening" as const, label: "Social Listening", resolved: "socialListening" as const },
];

function hasResolvedData(
  resolved: StoredContextModules["resolvedSources"],
  key: (typeof MODULE_DEFS)[number]["resolved"],
): boolean {
  if (!resolved) return false;
  const entry = resolved[key];
  if (Array.isArray(entry)) return entry.length > 0;
  return !!entry;
}

/** Assess trustworthiness from persisted module toggles + resolved source refs. */
export function assessStoredContextQuality(
  modules: StoredContextModules,
): ContextQualityAssessment {
  const enabled = MODULE_DEFS.filter((m) => modules[m.toggle]);
  if (enabled.length === 0) {
    return {
      coveragePct: 0,
      notice:
        "Tidak ada modul riset yang diaktifkan — hasil analisis sepenuhnya dari pengetahuan umum AI.",
      warnings: [],
    };
  }

  const withData = enabled.filter((m) =>
    hasResolvedData(modules.resolvedSources, m.resolved),
  );
  const missing = enabled.filter(
    (m) => !hasResolvedData(modules.resolvedSources, m.resolved),
  );

  const coveragePct = Math.round((withData.length / enabled.length) * 100);
  const warnings: string[] = [];

  if (missing.length > 0) {
    warnings.push(
      `Modul aktif tanpa data: ${missing.map((m) => m.label).join(", ")}.`,
    );
  }

  if (coveragePct < 40) {
    return {
      coveragePct,
      notice:
        "Cakupan data riset sangat terbatas. Gap matrix & USP bersifat eksploratif — jalankan modul 1–5 atau pilih sumber spesifik sebelum keputusan GO.",
      warnings,
    };
  }

  if (coveragePct < 70) {
    return {
      coveragePct,
      notice:
        "Sebagian modul aktif belum punya data siap. Interpretasikan skor diferensiasi sebagai indikasi awal, bukan bukti penuh.",
      warnings,
    };
  }

  return {
    coveragePct,
    notice: null,
    warnings,
  };
}

/** Server-side: count populated context sections after gather. */
export function assessGatheredContextQuality(
  contextModules: StoredContextModules,
  context: UspGatheredContext,
): ContextQualityAssessment {
  const sectionMap: Record<string, boolean> = {
    reviewIntel: !!context.reviewIntel,
    competitor: !!context.competitor,
    trendRadar: !!context.trendRadar,
    keywordIntel: !!context.keywordIntel,
    socialListening: !!context.socialListening,
  };

  const enabled = MODULE_DEFS.filter((m) => contextModules[m.toggle]);
  const withData = enabled.filter((m) => sectionMap[m.toggle]);
  const missing = enabled.filter((m) => !sectionMap[m.toggle]);

  const coveragePct =
    enabled.length > 0
      ? Math.round((withData.length / enabled.length) * 100)
      : 0;

  const warnings = missing.length
    ? [`Tidak ada data terkumpul untuk: ${missing.map((m) => m.label).join(", ")}.`]
    : [];

  if (coveragePct < 40) {
    return {
      coveragePct,
      notice:
        "Konteks riset sangat tipis — AI akan mengandalkan inferensi umum. Tambah scrape review, kompetitor, atau keyword sebelum analisis ulang.",
      warnings,
    };
  }

  if (coveragePct < 70) {
    return {
      coveragePct,
      notice:
        "Analisis menggunakan data parsial. Perkuat modul yang kosong untuk USP yang lebih terbukti.",
      warnings,
    };
  }

  return { coveragePct, notice: null, warnings };
}
