import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildResearchAiStep,
  generateResearchJson,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import { gatherBrandContext, GROUNDING_SOURCE_LABELS } from "./grounding";
import {
  buildCritiquePrompt,
  buildGenerationPrompt,
  IDEA_COUNT,
  selectFewShot,
  type FewShotIdea,
} from "./idea-prompt";

const ALLOWED_SOURCES = new Set([
  "reviews",
  "ad_library",
  "trends",
  "brand_voice",
  "topic",
]);

type RawIdea = Record<string, unknown>;

type NormalizedIdea = {
  title: string;
  angle: string;
  format: string | null;
  hook: string | null;
  platform: string | null;
  cta: string | null;
  score: number | null;
  citations: { source: string; text: string }[];
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCitations(raw: unknown): { source: string; text: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { source: string; text: string }[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const text = asString(o.text);
    if (!text) continue;
    let source = asString(o.source)?.toLowerCase() ?? "topic";
    if (!ALLOWED_SOURCES.has(source)) source = "topic";
    out.push({ source, text: text.slice(0, 300) });
  }
  return out;
}

function normalizeIdea(raw: RawIdea): NormalizedIdea | null {
  const title = asString(raw.title);
  const angle = asString(raw.angle);
  if (!title || !angle) return null;
  let score: number | null = null;
  if (typeof raw.score === "number" && Number.isFinite(raw.score)) {
    score = Math.max(0, Math.min(100, Math.round(raw.score)));
  }
  return {
    title: title.slice(0, 200),
    angle: angle.slice(0, 600),
    format: asString(raw.format),
    hook: asString(raw.hook),
    platform: asString(raw.platform),
    cta: asString(raw.cta),
    score,
    citations: normalizeCitations(raw.citations),
  };
}

function parseIdeas(payload: { ideas?: unknown }): NormalizedIdea[] {
  if (!payload || !Array.isArray(payload.ideas)) return [];
  return payload.ideas
    .map((r) => normalizeIdea(r as RawIdea))
    .filter((i): i is NormalizedIdea => i !== null);
}

function buildSummary(count: number, usedSources: string[]): string {
  if (!usedSources.length) {
    return `${count} ide konten berbasis topik (belum ada data brand untuk grounding).`;
  }
  const labels = usedSources
    .map((s) => GROUNDING_SOURCE_LABELS[s] ?? s)
    .join(", ");
  return `${count} ide konten — digrounding dari ${labels}.`;
}

function buildDataNotice(usedSources: string[]): string | null {
  if (usedSources.length) return null;
  return "Belum ada data brand (Review Intel / Ad Library / Trend Radar / Brand Strategy) untuk grounding — ide masih berbasis topik saja. Tambahkan data brand agar ide jauh lebih tajam & relevan.";
}

/**
 * Jalankan generate ide untuk satu set: kumpulkan grounding + few-shot →
 * generate (divergen) → self-critique (anti-generic) → simpan dengan citation.
 * Idempotent: ide lama set ini diganti.
 */
export async function runIdeaGeneration(setId: string): Promise<void> {
  const set = await prisma.contentStudioIdeaSet.findUnique({
    where: { id: setId },
  });
  if (!set) return;

  try {
    await prisma.contentStudioIdeaSet.update({
      where: { id: setId },
      data: { status: "COLLECTING", errorMessage: null },
    });

    const ctx = await gatherBrandContext(set.ownerBrandId, set.createdById);

    const priorIdeas = set.ownerBrandId
      ? await prisma.contentStudioIdea.findMany({
          where: {
            ownerBrandId: set.ownerBrandId,
            OR: [{ feedback: { not: null } }, { used: true }],
          },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { title: true, angle: true, hook: true, feedback: true, used: true },
        })
      : [];

    const fewShot = selectFewShot(
      priorIdeas.map(
        (i): FewShotIdea => ({
          title: i.title,
          angle: i.angle,
          hook: i.hook,
          feedback: i.feedback,
          used: i.used,
        }),
      ),
    );

    await prisma.contentStudioIdeaSet.update({
      where: { id: setId },
      data: { status: "ANALYZING" },
    });

    // Pass 1 — generate divergen, grounded.
    const generated = await generateResearchJson<{ ideas?: unknown }>(
      buildGenerationPrompt({
        topic: set.topic,
        goal: set.goal,
        platforms: set.platforms,
        brandName: ctx.brandName,
        ctx,
        fewShot,
      }),
      {
        tier: "pro",
        maxRetries: 2,
        validate: (p) => Array.isArray((p as { ideas?: unknown }).ideas),
      },
    );
    let ideas = parseIdeas(generated);
    if (!ideas.length) {
      throw new Error("AI tidak menghasilkan ide yang valid.");
    }

    // Pass 2 — self-critique: nilai ketajaman & tulis ulang yang generic.
    try {
      const critiqued = await generateResearchJson<{ ideas?: unknown }>(
        buildCritiquePrompt(JSON.stringify({ ideas }, null, 2), set.topic),
        {
          tier: "pro",
          maxRetries: 1,
          validate: (p) => Array.isArray((p as { ideas?: unknown }).ideas),
        },
      );
      const refined = parseIdeas(critiqued);
      if (refined.length) ideas = refined;
    } catch (err) {
      // Critique opsional — kalau gagal, pakai hasil pass 1.
      console.warn("[content-studio] self-critique gagal, pakai pass 1", err);
    }

    ideas = ideas.slice(0, IDEA_COUNT);

    const aiMeta = researchAiMetaFromSteps([
      buildResearchAiStep("Generate ide konten", "pro"),
      buildResearchAiStep("Self-critique ketajaman", "pro"),
    ]);

    await prisma.$transaction([
      prisma.contentStudioIdea.deleteMany({ where: { setId } }),
      prisma.contentStudioIdea.createMany({
        data: ideas.map((i) => ({
          setId,
          ownerBrandId: set.ownerBrandId,
          title: i.title,
          angle: i.angle,
          format: i.format,
          hook: i.hook,
          platform: i.platform,
          cta: i.cta,
          score: i.score,
          citations: i.citations as unknown as Prisma.InputJsonValue,
        })),
      }),
      prisma.contentStudioIdeaSet.update({
        where: { id: setId },
        data: {
          status: "READY",
          groundingSources: ctx.usedSources,
          aiSummary: buildSummary(ideas.length, ctx.usedSources),
          dataNotice: buildDataNotice(ctx.usedSources),
          aiMeta: aiMeta as unknown as Prisma.InputJsonValue,
          errorMessage: null,
        },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal generate ide.";
    await prisma.contentStudioIdeaSet.update({
      where: { id: setId },
      data: { status: "FAILED", errorMessage: message.slice(0, 500) },
    });
    console.error("[content-studio] runIdeaGeneration gagal", err);
  }
}
