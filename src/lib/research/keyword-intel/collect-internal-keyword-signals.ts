import "server-only";

import { prisma } from "@/lib/prisma";
import {
  signalId,
  type NormalizedKeywordSignal,
} from "@/lib/research/keyword-intel/keyword-signal-types";

type ThemeRow = { theme?: string; count?: number; text?: string; value?: number };

function parseThemes(json: unknown): ThemeRow[] {
  if (!Array.isArray(json)) return [];
  return json as ThemeRow[];
}

function matchesSeed(text: string, seeds: string[]): boolean {
  if (seeds.length === 0) return true;
  const hay = text.toLowerCase();
  return seeds.some((s) => hay.includes(s) || s.includes(hay));
}

export async function collectInternalKeywordSignals(input: {
  category: string;
  seedKeyword?: string | null;
  reviewIntel: boolean;
  socialListening: boolean;
}): Promise<NormalizedKeywordSignal[]> {
  const signals: NormalizedKeywordSignal[] = [];
  const seeds = [
    input.category.toLowerCase(),
    ...(input.seedKeyword ? [input.seedKeyword.toLowerCase()] : []),
  ];

  if (input.reviewIntel) {
    const sources = await prisma.reviewIntelSource.findMany({
      where: { status: "READY" },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { summary: true },
    });

    for (const src of sources) {
      if (!src.summary) continue;
      const href = `/research-hub/review-intelligence/${src.id}`;
      const themes = [
        ...parseThemes(src.summary.topComplaints),
        ...parseThemes(src.summary.topPraises),
      ];
      for (const row of themes) {
        const theme = String(row.theme ?? row.text ?? "").trim();
        const count = Number(row.count ?? row.value ?? 0);
        if (!theme || count <= 0 || !matchesSeed(theme, seeds)) continue;
        signals.push({
          signalId: signalId("review_intel", theme, "theme_count"),
          source: "review_intel",
          keyword: theme,
          metric: "theme_count",
          value: count,
          moduleHref: href,
        });
      }
    }
  }

  if (input.socialListening) {
    const batches = await prisma.socialListeningBatch.findMany({
      where: { status: "READY" },
      orderBy: { collectedAt: "desc" },
      take: 6,
      include: { summary: true, monitor: true },
    });

    for (const batch of batches) {
      if (!batch.summary) continue;
      const href = `/research-hub/social-listening/${batch.monitorId}`;
      const themes = [
        ...parseThemes(batch.summary.topPainPoints),
        ...parseThemes(batch.summary.topWishlist),
      ];
      for (const row of themes) {
        const theme = String(row.theme ?? row.text ?? "").trim();
        const count = Number(row.count ?? row.value ?? 0);
        if (!theme || count <= 0 || !matchesSeed(theme, seeds)) continue;
        signals.push({
          signalId: signalId("social_listening", theme, "mention_count"),
          source: "social_listening",
          keyword: theme,
          metric: "mention_count",
          value: count,
          moduleHref: href,
        });
      }
    }
  }

  return signals;
}
