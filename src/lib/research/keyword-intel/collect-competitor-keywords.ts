import "server-only";

import { prisma } from "@/lib/prisma";
import {
  normKeyword,
  signalId,
  type NormalizedKeywordSignal,
} from "@/lib/research/keyword-intel/keyword-signal-types";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function matchesCategory(text: string, category: string, seed?: string | null): boolean {
  const tokens = tokenize(`${category} ${seed ?? ""}`);
  const hay = text.toLowerCase();
  return tokens.some((t) => hay.includes(t));
}

export async function collectCompetitorKeywordSignals(input: {
  category: string;
  seedKeyword?: string | null;
}): Promise<NormalizedKeywordSignal[]> {
  const competitors = await prisma.researchCompetitor.findMany({
    where: { isActive: true },
    include: {
      skus: {
        select: { id: true, name: true, competitorId: true },
        take: 200,
      },
    },
    take: 20,
  });

  const termFreq = new Map<string, { count: number; href: string }>();

  for (const comp of competitors) {
    const href = `/research-hub/competitor-tracker/${comp.id}`;
    for (const sku of comp.skus) {
      if (!matchesCategory(sku.name, input.category, input.seedKeyword)) continue;
      for (const token of tokenize(sku.name)) {
        const existing = termFreq.get(token);
        if (existing) {
          existing.count += 1;
        } else {
          termFreq.set(token, { count: 1, href });
        }
      }
      const phrase = sku.name.trim().slice(0, 120);
      if (phrase.length > 4 && matchesCategory(phrase, input.category, input.seedKeyword)) {
        const key = normKeyword(phrase);
        const existing = termFreq.get(key);
        if (existing) {
          existing.count += 2;
        } else {
          termFreq.set(key, { count: 2, href });
        }
      }
    }
  }

  return [...termFreq.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 40)
    .map(([term, meta]) => ({
      signalId: signalId("competitor", term, "title_frequency"),
      source: "competitor" as const,
      keyword: term,
      metric: "title_frequency",
      value: meta.count,
      moduleHref: meta.href,
    }));
}
