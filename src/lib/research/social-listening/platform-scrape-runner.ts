import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import {
  isInstagramMentionsConfigured,
  pollInstagramScrapes,
  startInstagramScrapes,
} from "@/lib/research/social-listening/scrape-instagram-mentions";
import {
  isTikTokMentionsConfigured,
  pollTikTokScrape,
  startTikTokScrape,
} from "@/lib/research/social-listening/scrape-tiktok-mentions";

export type PlatformSyncStatus = "COLLECTING" | "READY" | "FAILED" | "SKIPPED";

export type PlatformRunIds = Partial<
  Record<SocialListeningPlatform, string | string[]>
>;

export type PlatformStatusMap = Partial<
  Record<SocialListeningPlatform, PlatformSyncStatus>
>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatRunRef(runId: string | string[] | undefined): string {
  if (!runId) return "";
  if (Array.isArray(runId)) return runId[0] ?? "";
  return runId;
}

export function platformStatusMessage(
  platform: SocialListeningPlatform,
  status: PlatformSyncStatus,
  runId?: string | string[],
): string {
  const label = platform === "TIKTOK" ? "TikTok" : "Instagram";
  const ref = formatRunRef(runId);

  switch (status) {
    case "COLLECTING":
      return ref
        ? `${label} masih mengumpulkan data (Apify run ${ref.slice(0, 12)}…)`
        : `${label} masih mengumpulkan data…`;
    case "READY":
      return `${label} selesai`;
    case "FAILED":
      return ref
        ? `${label} gagal atau timeout (Apify run ${ref.slice(0, 12)}…)`
        : `${label} gagal atau timeout`;
    case "SKIPPED":
      return `${label} dilewati — API belum dikonfigurasi`;
    default:
      return label;
  }
}

export async function startPlatformScrapes(input: {
  platforms: SocialListeningPlatform[];
  keywords: string[];
}): Promise<{
  apifyRunIds: PlatformRunIds;
  platformStatus: PlatformStatusMap;
  warnings: string[];
}> {
  const apifyRunIds: PlatformRunIds = {};
  const platformStatus: PlatformStatusMap = {};
  const warnings: string[] = [];

  const starters = input.platforms.map(async (platform) => {
    if (platform === SocialListeningPlatform.TIKTOK) {
      if (!isTikTokMentionsConfigured()) {
        platformStatus[platform] = "SKIPPED";
        warnings.push("TikTok Apify belum dikonfigurasi — lewati platform TikTok.");
        return;
      }
      try {
        const started = await startTikTokScrape(input.keywords);
        if (!started) {
          platformStatus[platform] = "FAILED";
          warnings.push("TikTok: gagal memulai scrape.");
          return;
        }
        apifyRunIds[platform] = started.runId;
        platformStatus[platform] = "COLLECTING";
      } catch (err) {
        platformStatus[platform] = "FAILED";
        warnings.push(
          `TikTok: gagal memulai scrape — ${err instanceof Error ? err.message : "error"}`,
        );
      }
      return;
    }

    if (platform === SocialListeningPlatform.INSTAGRAM) {
      if (!isInstagramMentionsConfigured()) {
        platformStatus[platform] = "SKIPPED";
        warnings.push(
          "APIFY_ACTOR_INSTAGRAM belum diset — lewati platform Instagram.",
        );
        return;
      }
      try {
        const runIds = await startInstagramScrapes(input.keywords);
        if (runIds.length === 0) {
          platformStatus[platform] = "FAILED";
          warnings.push("Instagram: gagal memulai scrape.");
          return;
        }
        apifyRunIds[platform] =
          runIds.length === 1 ? runIds[0]! : runIds;
        platformStatus[platform] = "COLLECTING";
      } catch (err) {
        platformStatus[platform] = "FAILED";
        warnings.push(
          `Instagram: gagal memulai scrape — ${err instanceof Error ? err.message : "error"}`,
        );
      }
    }
  });

  await Promise.all(starters);
  return { apifyRunIds, platformStatus, warnings };
}

export async function pollPlatformScrapes(input: {
  platforms: SocialListeningPlatform[];
  apifyRunIds: PlatformRunIds;
  currentStatus: PlatformStatusMap;
}): Promise<{
  platformStatus: PlatformStatusMap;
  mentions: RawSocialMention[];
  warnings: string[];
  allDone: boolean;
}> {
  const platformStatus: PlatformStatusMap = { ...input.currentStatus };
  const warnings: string[] = [];
  const mentionBatches: RawSocialMention[][] = [];
  /** Cached mentions per platform once READY — re-included on every poll. */
  const readyMentions: Partial<
    Record<SocialListeningPlatform, RawSocialMention[]>
  > = {};

  for (const platform of input.platforms) {
    const prev = platformStatus[platform];
    if (prev === "SKIPPED" || prev === "FAILED") continue;

    if (prev === "READY") {
      if (readyMentions[platform]?.length) {
        mentionBatches.push(readyMentions[platform]!);
      }
      continue;
    }

    const runRef = input.apifyRunIds[platform];

    if (platform === SocialListeningPlatform.TIKTOK) {
      const runId = typeof runRef === "string" ? runRef : null;
      if (!runId) {
        platformStatus[platform] = "FAILED";
        warnings.push(platformStatusMessage(platform, "FAILED"));
        continue;
      }

      const result = await pollTikTokScrape(runId);
      if (!result.done) {
        platformStatus[platform] = "COLLECTING";
        continue;
      }

      if (result.succeeded) {
        platformStatus[platform] = "READY";
        readyMentions[platform] = result.mentions;
        mentionBatches.push(result.mentions);
        if (result.mentions.length === 0) {
          warnings.push(
            "TikTok: scrape selesai tapi tidak ada mention ditemukan.",
          );
        }
      } else {
        platformStatus[platform] = "FAILED";
        warnings.push(
          platformStatusMessage(platform, "FAILED", runId) +
            (result.apifyStatus ? ` (${result.apifyStatus})` : ""),
        );
      }
      continue;
    }

    if (platform === SocialListeningPlatform.INSTAGRAM) {
      const runIds = Array.isArray(runRef)
        ? runRef
        : typeof runRef === "string"
          ? [runRef]
          : [];

      const result = await pollInstagramScrapes(runIds);
      if (!result.done) {
        platformStatus[platform] = "COLLECTING";
        continue;
      }

      if (result.succeeded) {
        platformStatus[platform] = "READY";
        readyMentions[platform] = result.mentions;
        mentionBatches.push(result.mentions);
        if (result.mentions.length === 0) {
          warnings.push(
            "Instagram: scrape selesai tapi tidak ada post ditemukan untuk keyword/hashtag ini.",
          );
        }
      } else {
        platformStatus[platform] = "FAILED";
        warnings.push(
          platformStatusMessage(platform, "FAILED", runIds) +
            (result.apifyStatuses.length > 0
              ? ` (status: ${result.apifyStatuses.join(", ")})`
              : ""),
        );
      }
    }
  }

  const allDone = input.platforms.every((p) => {
    const s = platformStatus[p];
    return s === "READY" || s === "FAILED" || s === "SKIPPED";
  });

  return {
    platformStatus,
    mentions: dedupeMentions(mentionBatches.flat()),
    warnings,
    allDone,
  };
}

function dedupeMentions(mentions: RawSocialMention[]): RawSocialMention[] {
  const seen = new Map<string, RawSocialMention>();
  for (const m of mentions) {
    const key = `${m.platform}:${m.externalId}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, m);
      continue;
    }
    const mergedComments = [
      ...(existing.scrapedComments ?? []),
      ...(m.scrapedComments ?? []),
    ];
    seen.set(key, {
      ...existing,
      likes: Math.max(existing.likes, m.likes),
      comments: Math.max(existing.comments, m.comments),
      views: Math.max(existing.views, m.views),
      scrapedComments: mergedComments.length > 0 ? mergedComments : undefined,
    });
  }
  return [...seen.values()];
}

export async function waitForPlatformScrapes(input: {
  platforms: SocialListeningPlatform[];
  apifyRunIds: PlatformRunIds;
  platformStatus: PlatformStatusMap;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}): Promise<{
  platformStatus: PlatformStatusMap;
  mentions: RawSocialMention[];
  warnings: string[];
}> {
  const pollIntervalMs = input.pollIntervalMs ?? 10_000;
  const maxWaitMs = input.maxWaitMs ?? 1_800_000;
  const started = Date.now();
  let currentStatus = { ...input.platformStatus };
  let mentions: RawSocialMention[] = [];
  const warnings: string[] = [];

  while (Date.now() - started < maxWaitMs) {
    const result = await pollPlatformScrapes({
      platforms: input.platforms,
      apifyRunIds: input.apifyRunIds,
      currentStatus,
    });
    currentStatus = result.platformStatus;
    mentions = dedupeMentions([...mentions, ...result.mentions]);
    warnings.push(...result.warnings);

    if (result.allDone) {
      return { platformStatus: currentStatus, mentions, warnings };
    }

    await sleep(pollIntervalMs);
  }

  for (const platform of input.platforms) {
    if (currentStatus[platform] === "COLLECTING") {
      currentStatus[platform] = "FAILED";
      warnings.push(
        platformStatusMessage(
          platform,
          "FAILED",
          input.apifyRunIds[platform],
        ) + " — batas waktu polling tercapai",
      );
    }
  }

  return { platformStatus: currentStatus, mentions, warnings };
}
