import "server-only";

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { NormalizedTrendSignal } from "@/lib/research/trend-radar/trend-signal-types";

type ThemeRow = { theme?: string; count?: number; text?: string; value?: number };

function signalId(source: string, term: string, metric: string): string {
  return createHash("sha256")
    .update(`${source}|${term}|${metric}`)
    .digest("hex")
    .slice(0, 16);
}

function parseThemes(json: unknown): ThemeRow[] {
  if (!Array.isArray(json)) return [];
  return json as ThemeRow[];
}

export async function collectInternalTrendSignals(opts: {
  reviewIntel: boolean;
  competitor: boolean;
  keywordIntel: boolean;
  socialListening: boolean;
  seedKeywords?: string[];
}): Promise<NormalizedTrendSignal[]> {
  const signals: NormalizedTrendSignal[] = [];
  const seeds = (opts.seedKeywords ?? []).map((s) => s.toLowerCase());

  if (opts.reviewIntel) {
    const sources = await prisma.reviewIntelSource.findMany({
      where: { status: "READY" },
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: { summary: true },
    });

    for (const src of sources) {
      if (!src.summary) continue;
      const complaints = parseThemes(src.summary.topComplaints);
      const praises = parseThemes(src.summary.topPraises);
      const href = `/research-hub/review-intelligence/${src.id}`;

      for (const row of complaints) {
        const theme = String(row.theme ?? row.text ?? "").trim();
        const count = Number(row.count ?? row.value ?? 0);
        if (!theme || count <= 0) continue;
        if (
          seeds.length > 0 &&
          !seeds.some(
            (s) =>
              theme.toLowerCase().includes(s) ||
              src.productName.toLowerCase().includes(s),
          )
        ) {
          continue;
        }
        signals.push({
          signalId: signalId("review_intel", theme, "complaint_count"),
          source: "review_intel",
          term: theme,
          metric: "complaint_count",
          value: count,
          moduleHref: href,
          meta: { productName: src.productName, type: "complaint" },
        });
      }

      for (const row of praises) {
        const theme = String(row.theme ?? row.text ?? "").trim();
        const count = Number(row.count ?? row.value ?? 0);
        if (!theme || count <= 0) continue;
        signals.push({
          signalId: signalId("review_intel", theme, "praise_count"),
          source: "review_intel",
          term: theme,
          metric: "praise_count",
          value: count,
          moduleHref: href,
          meta: { productName: src.productName, type: "praise" },
        });
      }
    }
  }

  if (opts.competitor) {
    const snapshots = await prisma.competitorSnapshot.findMany({
      where: {
        reviewCount: { not: null },
        capturedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { capturedAt: "asc" },
      include: {
        sku: { select: { id: true, name: true, competitorId: true } },
      },
      take: 5000,
    });

    const bySku = new Map<
      string,
      { name: string; competitorId: string; first: number; last: number }
    >();

    for (const snap of snapshots) {
      if (!snap.skuId || snap.reviewCount == null || !snap.sku) continue;
      const existing = bySku.get(snap.skuId);
      if (!existing) {
        bySku.set(snap.skuId, {
          name: snap.sku.name,
          competitorId: snap.sku.competitorId,
          first: snap.reviewCount,
          last: snap.reviewCount,
        });
      } else {
        existing.last = snap.reviewCount;
      }
    }

    for (const [skuId, row] of bySku) {
      const delta = row.last - row.first;
      if (delta <= 0 && row.last < 10) continue;
      const deltaPct =
        row.first > 0 ? ((row.last - row.first) / row.first) * 100 : null;
      signals.push({
        signalId: signalId("competitor", row.name, "review_delta"),
        source: "competitor",
        term: row.name,
        metric: "review_count_delta",
        value: delta,
        deltaPct,
        moduleHref: `/research-hub/competitor-tracker/${row.competitorId}`,
        meta: { skuId, reviewCount: row.last },
      });
    }
  }

  if (opts.keywordIntel) {
    const queries = await prisma.keywordIntelQuery.findMany({
      where: { status: "READY" },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { result: true },
    });

    for (const q of queries) {
      if (!q.result?.keywordMatrix) continue;
      const matrix = q.result.keywordMatrix as {
        keyword?: string;
        volume?: number;
        competition?: number;
        trend?: string;
      }[];
      const href = `/research-hub/keyword-intel/${q.id}`;

      for (const row of matrix.slice(0, 25)) {
        const keyword = String(row.keyword ?? "").trim();
        if (!keyword) continue;
        const volume = Number(row.volume ?? 0);
        const trend = row.trend ?? "stable";
        signals.push({
          signalId: signalId("keyword_intel", keyword, "search_volume"),
          source: "keyword_intel",
          term: keyword,
          metric: "search_volume",
          value: volume,
          moduleHref: href,
          meta: {
            competition: row.competition,
            trend,
            category: q.category,
          },
        });
        if (trend === "up") {
          signals.push({
            signalId: signalId("keyword_intel", keyword, "trend_up"),
            source: "keyword_intel",
            term: keyword,
            metric: "interest_trend",
            value: 1,
            moduleHref: href,
            meta: { trend: "up" },
          });
        } else if (trend === "down") {
          signals.push({
            signalId: signalId("keyword_intel", keyword, "trend_down"),
            source: "keyword_intel",
            term: keyword,
            metric: "interest_trend",
            value: -1,
            moduleHref: href,
            meta: { trend: "down" },
          });
        }
      }
    }
  }

  if (opts.socialListening) {
    const batches = await prisma.socialListeningBatch.findMany({
      where: { status: "READY" },
      orderBy: { collectedAt: "desc" },
      take: 5,
      include: { summary: true, monitor: { select: { id: true, name: true } } },
    });

    for (const batch of batches) {
      if (!batch.summary) continue;
      const href = `/research-hub/social-listening/${batch.monitorId}`;
      const painPoints = parseThemes(batch.summary.topPainPoints);
      const wishlist = parseThemes(batch.summary.topWishlist);
      const commentPain = parseThemes(batch.summary.topCommentPainPoints);
      const commentWish = parseThemes(batch.summary.topCommentWishlist);

      for (const row of painPoints) {
        const text = String(row.theme ?? row.text ?? "").trim();
        const count = Number(row.count ?? row.value ?? 0);
        if (!text || count <= 0) continue;
        signals.push({
          signalId: signalId("social_listening", text, "pain_point"),
          source: "social_listening",
          term: text,
          metric: "pain_point_mentions",
          value: count,
          moduleHref: href,
          meta: { monitorName: batch.monitor.name },
        });
      }

      for (const row of wishlist) {
        const text = String(row.theme ?? row.text ?? "").trim();
        const count = Number(row.count ?? row.value ?? 0);
        if (!text || count <= 0) continue;
        signals.push({
          signalId: signalId("social_listening", text, "wishlist"),
          source: "social_listening",
          term: text,
          metric: "wishlist_mentions",
          value: count,
          moduleHref: href,
          meta: { monitorName: batch.monitor.name },
        });
      }

      for (const row of commentPain) {
        const text = String(row.theme ?? row.text ?? "").trim();
        const count = Number(row.count ?? row.value ?? 0);
        if (!text || count <= 0) continue;
        signals.push({
          signalId: signalId("social_listening", text, "comment_pain"),
          source: "social_listening",
          term: text,
          metric: "comment_pain_mentions",
          value: count,
          moduleHref: href,
          meta: { monitorName: batch.monitor.name, source: "comment" },
        });
      }

      for (const row of commentWish) {
        const text = String(row.theme ?? row.text ?? "").trim();
        const count = Number(row.count ?? row.value ?? 0);
        if (!text || count <= 0) continue;
        signals.push({
          signalId: signalId("social_listening", text, "comment_wishlist"),
          source: "social_listening",
          term: text,
          metric: "comment_wishlist_mentions",
          value: count,
          moduleHref: href,
          meta: { monitorName: batch.monitor.name, source: "comment" },
        });
      }
    }
  }

  return signals;
}
