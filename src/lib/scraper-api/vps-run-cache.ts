import "server-only";

import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";

export type CachedVpsRun = {
  done: boolean;
  succeeded: boolean;
  mentions: RawSocialMention[];
  status: string;
};

const cache = new Map<string, CachedVpsRun>();

export function cacheVpsRun(runId: string, data: CachedVpsRun): void {
  cache.set(runId, data);
}

export function getCachedVpsRun(runId: string): CachedVpsRun | null {
  return cache.get(runId) ?? null;
}

export function popCachedVpsRun(runId: string): CachedVpsRun | null {
  const value = cache.get(runId);
  if (value) cache.delete(runId);
  return value ?? null;
}
