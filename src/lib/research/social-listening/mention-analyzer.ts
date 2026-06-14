import "server-only";

import { SocialMentionClass } from "@prisma/client";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
  type ResearchAiMeta,
} from "@/lib/research/llm";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import {
  attachMentionIds,
  buildMentionAnalysisPrompt,
  chunkMentions,
} from "@/lib/research/social-listening/prompts/mention-analysis";

export type ClassifiedMention = RawSocialMention & {
  classification: SocialMentionClass;
  painPoint: string | null;
  isViral: boolean;
};

type BatchResult = {
  classifications: {
    id: string;
    classification: SocialMentionClass;
    painPoint: string | null;
    isViral: boolean;
  }[];
  aiSummary: string;
};

const VALID_CLASSES = new Set<string>(Object.values(SocialMentionClass));

function normalizeClass(value: string): SocialMentionClass {
  const upper = value.toUpperCase();
  if (VALID_CLASSES.has(upper)) return upper as SocialMentionClass;
  return SocialMentionClass.NEUTRAL;
}

function heuristicClassify(mention: RawSocialMention): ClassifiedMention {
  const lower = mention.text.toLowerCase();
  let classification: SocialMentionClass = SocialMentionClass.NEUTRAL;
  let painPoint: string | null = null;

  if (
    /pengen|semoga ada|wish|kepingin|ada nggak|susah cari/.test(lower)
  ) {
    classification = SocialMentionClass.WISHLIST;
    painPoint = mention.text.slice(0, 120);
  } else if (/bagus|worth|rekomend|suka|love|mantap/.test(lower)) {
    classification = SocialMentionClass.PRAISE;
  } else if (/\?|gimana|kenapa|tips|tanya/.test(lower)) {
    classification = SocialMentionClass.QUESTION;
  } else if (/kecewa|jelek|lengket|mahal|ribet|gagal|buruk/.test(lower)) {
    classification = SocialMentionClass.COMPLAINT;
    painPoint = mention.text.slice(0, 120);
  } else if (/coba|pakai|review|worth it/.test(lower)) {
    classification = SocialMentionClass.RECOMMENDATION;
  }

  const engagement = mention.likes + mention.comments * 2;
  const isViral =
    mention.views >= 100_000 || engagement >= 5_000 || mention.likes >= 3_000;

  return {
    ...mention,
    classification,
    painPoint,
    isViral,
  };
}

export async function classifyMentions(input: {
  monitorName: string;
  keywords: string[];
  mentions: RawSocialMention[];
}): Promise<{
  classified: ClassifiedMention[];
  aiSummary: string;
  aiMeta: ResearchAiMeta | null;
}> {
  if (input.mentions.length === 0) {
    return {
      classified: [],
      aiSummary: "Belum ada mention terkumpul.",
      aiMeta: null,
    };
  }

  const withIds = attachMentionIds(input.mentions);
  const chunks = chunkMentions(withIds, 25);
  const classified: ClassifiedMention[] = [];
  const summaries: string[] = [];
  let usedFlashBatch = false;

  for (const chunk of chunks) {
    try {
      const prompt = buildMentionAnalysisPrompt({
        monitorName: input.monitorName,
        keywords: input.keywords,
        mentions: chunk.map((c) => ({
          id: c.id,
          text: c.mention.text,
          platform: c.mention.platform,
        })),
      });

      const result = await generateResearchJson<BatchResult>(prompt);
      if (!usedFlashBatch) usedFlashBatch = true;
      const byId = new Map(
        (result.classifications ?? []).map((c) => [c.id, c]),
      );

      for (const row of chunk) {
        const hit = byId.get(row.id);
        if (hit) {
          classified.push({
            ...row.mention,
            classification: normalizeClass(hit.classification),
            painPoint: hit.painPoint ?? null,
            isViral: !!hit.isViral,
          });
        } else {
          classified.push(heuristicClassify(row.mention));
        }
      }

      if (result.aiSummary) summaries.push(result.aiSummary);
    } catch (err) {
      console.warn("[mention-analyzer] batch gagal, fallback heuristic", err);
      for (const row of chunk) {
        classified.push(heuristicClassify(row.mention));
      }
    }
  }

  return {
    classified,
    aiSummary: summaries.join(" ") || "Analisis social listening selesai.",
    aiMeta: usedFlashBatch
      ? researchAiMetaFromSteps([
          buildResearchAiStep("Klasifikasi mention", "flash"),
        ])
      : null,
  };
}
