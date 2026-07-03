import type { ResearchModelTier, ResearchLlmProvider } from "@/lib/research/llm/types";
import {
  defaultOllamaModelForTier,
  RESEARCH_DEFAULT_OLLAMA_MODELS,
} from "@/lib/research/llm/defaults";

export type ResearchModuleModelStep = {
  label: string;
  tier: ResearchModelTier;
};

export type ResearchModuleAiProfile = {
  moduleKey: string;
  label: string;
  steps: ResearchModuleModelStep[];
};

/** Label tampilan human-readable untuk ID model API. */
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  [RESEARCH_DEFAULT_OLLAMA_MODELS.flash]: "DeepSeek V4 Flash",
  [RESEARCH_DEFAULT_OLLAMA_MODELS.pro]: "DeepSeek V4 Pro",
  "deepseek-v4-flash": "DeepSeek V4 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
};

export function formatModelShortName(model: string): string {
  const normalized = model.trim().toLowerCase();
  if (MODEL_DISPLAY_NAMES[normalized]) return MODEL_DISPLAY_NAMES[normalized];

  const withoutCloud = model.replace(/:cloud$/i, "").toLowerCase();
  if (MODEL_DISPLAY_NAMES[withoutCloud]) return MODEL_DISPLAY_NAMES[withoutCloud];

  return model
    .replace(/:cloud$/i, "")
    .replace(/^deepseek-/i, "DeepSeek ")
    .replace(/^gemini-/i, "Gemini ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function formatTierLabel(tier: ResearchModelTier): string {
  return tier === "pro" ? "Pro" : "Flash";
}

export function formatTierModelLabel(
  tier: ResearchModelTier,
  model?: string,
): string {
  return formatModelShortName(model ?? defaultOllamaModelForTier(tier));
}

/** Peta tier default per modul — selaras dengan analyzer di backend. */
export const RESEARCH_MODULE_AI_PROFILES: ResearchModuleAiProfile[] = [
  {
    moduleKey: "product-discovery",
    label: "Product Discovery",
    steps: [{ label: "Ringkasan pasar & rencana aksi", tier: "flash" }],
  },
  {
    moduleKey: "review-intelligence",
    label: "Review Intelligence",
    steps: [
      { label: "Klasifikasi review", tier: "flash" },
      { label: "Gap opportunity & rencana aksi", tier: "pro" },
    ],
  },
  {
    moduleKey: "competitor-tracker",
    label: "Competitor Tracker",
    steps: [{ label: "Insight kompetitor", tier: "flash" }],
  },
  {
    moduleKey: "trend-radar",
    label: "Trend Radar",
    steps: [
      { label: "Analisis tren", tier: "pro" },
      { label: "Rencana aksi", tier: "pro" },
    ],
  },
  {
    moduleKey: "keyword-intel",
    label: "Keyword Intel",
    steps: [{ label: "Analisis keyword & copy", tier: "flash" }],
  },
  {
    moduleKey: "social-listening",
    label: "Social Listening",
    steps: [
      { label: "Klasifikasi mention", tier: "flash" },
      { label: "Rencana aksi sosial", tier: "pro" },
    ],
  },
  {
    moduleKey: "usp-analyzer",
    label: "USP Analyzer",
    steps: [{ label: "Gap matrix & positioning", tier: "pro" }],
  },
  {
    moduleKey: "concept-lab",
    label: "Concept Lab",
    steps: [
      { label: "Generate konsep", tier: "pro" },
      { label: "Validasi skor", tier: "pro" },
      { label: "Perbandingan konsep", tier: "pro" },
    ],
  },
  {
    moduleKey: "product-innovation",
    label: "Product Innovation",
    steps: [{ label: "SCAMPER ideation", tier: "pro" }],
  },
  {
    moduleKey: "research-reports",
    label: "Research Reports",
    steps: [{ label: "Laporan riset", tier: "pro" }],
  },
];

export function researchModuleFromPathname(
  pathname: string,
): ResearchModuleAiProfile | null {
  const normalized = pathname.replace(/\/$/, "");
  for (const profile of RESEARCH_MODULE_AI_PROFILES) {
    if (
      normalized === `/research-hub/${profile.moduleKey}` ||
      normalized.startsWith(`/research-hub/${profile.moduleKey}/`)
    ) {
      return profile;
    }
  }
  return null;
}

export type ResearchAiMetaView = {
  steps: {
    label: string;
    tier: ResearchModelTier;
    provider: ResearchLlmProvider;
    model: string;
    generatedAt: string;
    promptVersion?: string;
    /** Terisi bila langkah AI gagal — output langkah ini tidak tersedia. */
    error?: string;
  }[];
};

export function parseResearchAiMetaClient(
  raw: unknown,
): ResearchAiMetaView | null {
  if (!raw || typeof raw !== "object") return null;
  const steps = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const valid = steps.filter(
    (s): s is ResearchAiMetaView["steps"][number] =>
      typeof s === "object" &&
      s != null &&
      typeof (s as { label?: unknown }).label === "string" &&
      ((s as { tier?: unknown }).tier === "flash" ||
        (s as { tier?: unknown }).tier === "pro") &&
      typeof (s as { model?: unknown }).model === "string" &&
      ((s as { provider?: unknown }).provider === "gemini" ||
        (s as { provider?: unknown }).provider === "ollama-cloud"),
  );
  return valid.length > 0 ? { steps: valid } : null;
}
