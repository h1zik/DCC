import "server-only";

import type { SocialMentionClass } from "@prisma/client";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  mergeResearchAiMeta,
  researchAiMetaFromSteps,
  type ResearchAiMeta,
} from "@/lib/research/llm";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import { classifyMentions } from "@/lib/research/social-listening/mention-analyzer";
import {
  attachMentionIds,
  buildCommentAnalysisPrompt,
  chunkMentions,
} from "@/lib/research/social-listening/prompts/comment-analysis";
import type {
  ClassifiedComment,
  RawSocialComment,
} from "@/lib/research/social-listening/social-comment-types";

type CommentBatchResult = {
  classifications: {
    id: string;
    classification: SocialMentionClass;
    painPoint: string | null;
  }[];
  commentAiSummary: string;
};

const VALID = new Set<string>([
  "COMPLAINT",
  "PRAISE",
  "QUESTION",
  "WISHLIST",
  "RECOMMENDATION",
  "NEUTRAL",
]);

function normalizeClass(value: string): SocialMentionClass {
  const upper = value.toUpperCase();
  return VALID.has(upper) ? (upper as SocialMentionClass) : "NEUTRAL";
}

function toPseudoMention(c: RawSocialComment): RawSocialMention {
  return {
    platform: c.platform,
    externalId: c.externalId,
    text: c.text,
    author: c.author,
    likes: c.likes,
    comments: 0,
    views: 0,
    postedAt: c.postedAt,
  };
}

function heuristicComment(c: RawSocialComment): ClassifiedComment {
  const lower = c.text.toLowerCase();
  let classification: SocialMentionClass = "NEUTRAL";
  let painPoint: string | null = null;

  if (/pengen|semoga|wish|kepingin|ada nggak|mau yang/.test(lower)) {
    classification = "WISHLIST";
    painPoint = c.text.slice(0, 120);
  } else if (/bagus|suka|rekomend|mantap|worth|love|joss/.test(lower)) {
    classification = "PRAISE";
  } else if (/\?|gimana|kenapa|tips|bener nggak/.test(lower)) {
    classification = "QUESTION";
  } else if (/kecewa|jelek|lengket|mahal|ribet|gagal|zona|breakout|irritasi/.test(lower)) {
    classification = "COMPLAINT";
    painPoint = c.text.slice(0, 120);
  } else if (/coba|pakai|udah|pake|review/.test(lower)) {
    classification = "RECOMMENDATION";
  }

  return { ...c, classification, painPoint };
}

export async function classifyComments(input: {
  monitorName: string;
  keywords: string[];
  comments: RawSocialComment[];
  existingMeta: ResearchAiMeta | null;
}): Promise<{
  classified: ClassifiedComment[];
  commentAiSummary: string | null;
  aiMeta: ResearchAiMeta | null;
}> {
  if (input.comments.length === 0) {
    return {
      classified: [],
      commentAiSummary: null,
      aiMeta: input.existingMeta,
    };
  }

  const withIds = attachMentionIds(
    input.comments.map((c) => toPseudoMention(c)),
  );
  const chunks = chunkMentions(withIds, 30);
  const classified: ClassifiedComment[] = [];
  const summaries: string[] = [];
  let usedFlash = false;

  for (const chunk of chunks) {
    try {
      const prompt = buildCommentAnalysisPrompt({
        monitorName: input.monitorName,
        keywords: input.keywords,
        comments: chunk.map((c) => ({
          id: c.id,
          text: c.mention.text,
          platform: c.mention.platform,
        })),
      });

      const result = await generateResearchJson<CommentBatchResult>(prompt);
      usedFlash = true;
      const byId = new Map(
        (result.classifications ?? []).map((c) => [c.id, c]),
      );

      for (const row of chunk) {
        const raw = input.comments.find(
          (c) => c.externalId === row.mention.externalId,
        );
        if (!raw) continue;
        const hit = byId.get(row.id);
        if (hit) {
          classified.push({
            ...raw,
            classification: normalizeClass(hit.classification),
            painPoint: hit.painPoint ?? null,
          });
        } else {
          classified.push(heuristicComment(raw));
        }
      }

      if (result.commentAiSummary) summaries.push(result.commentAiSummary);
    } catch (err) {
      console.warn("[comment-analyzer] batch gagal, fallback heuristic", err);
      for (const row of chunk) {
        const raw = input.comments.find(
          (c) => c.externalId === row.mention.externalId,
        );
        if (raw) classified.push(heuristicComment(raw));
      }
    }
  }

  if (classified.length < input.comments.length) {
    const done = new Set(classified.map((c) => c.externalId));
    for (const c of input.comments) {
      if (!done.has(c.externalId)) classified.push(heuristicComment(c));
    }
  }

  let aiMeta = input.existingMeta;
  if (usedFlash) {
    const step = buildResearchAiStep("Klasifikasi komentar", "flash");
    aiMeta = input.existingMeta
      ? mergeResearchAiMeta(input.existingMeta, step)
      : researchAiMetaFromSteps([step]);
  }

  return {
    classified,
    commentAiSummary:
      summaries.join(" ") ||
      (classified.length > 0
        ? `${classified.length} komentar dianalisis — lihat pain point & wishlist komentar di bawah.`
        : null),
    aiMeta,
  };
}

/** Fast path when LLM budget should be saved — reuse mention classifier. */
export async function classifyCommentsViaMentions(input: {
  monitorName: string;
  keywords: string[];
  comments: RawSocialComment[];
}): Promise<ClassifiedComment[]> {
  const pseudo = input.comments.map(toPseudoMention);
  const { classified } = await classifyMentions({
    monitorName: input.monitorName,
    keywords: input.keywords,
    mentions: pseudo,
  });

  return classified.map((m, i) => ({
    ...input.comments[i]!,
    classification: m.classification,
    painPoint: m.painPoint,
  }));
}
