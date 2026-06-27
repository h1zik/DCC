import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Cache respons DataForSEO di tabel `DataForSeoCache` untuk menghemat biaya API.
 * Default TTL 24 jam (sesuai persyaratan), dapat di-override per-call atau via
 * env `DATAFORSEO_CACHE_TTL_HOURS`.
 */

function defaultTtlMs(): number {
  const hours = Number(process.env.DATAFORSEO_CACHE_TTL_HOURS?.trim());
  if (Number.isFinite(hours) && hours > 0) return hours * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

/** Bangun cache key stabil dari endpoint + parameter permintaan. */
export function buildCacheKey(
  endpoint: string,
  params: Record<string, unknown>,
): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(params))
    .digest("hex")
    .slice(0, 32);
  return `${endpoint}:${hash}`;
}

/**
 * Jalankan `fetcher` dengan cache. Bila ada entri yang belum kedaluwarsa,
 * kembalikan payload tersimpan. Jika tidak, ambil data baru lalu simpan.
 *
 * Kegagalan tulis cache tidak menjatuhkan request — data segar tetap dikembalikan.
 */
export async function withDataForSeoCache<T>(
  endpoint: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  ttlMs: number = defaultTtlMs(),
): Promise<T> {
  const cacheKey = buildCacheKey(endpoint, params);
  const now = Date.now();

  try {
    const hit = await prisma.dataForSeoCache.findUnique({ where: { cacheKey } });
    if (hit && hit.expiresAt.getTime() > now) {
      return hit.payload as T;
    }
  } catch (err) {
    console.warn("[seo/dataforseo-cache] baca cache gagal", err);
  }

  const fresh = await fetcher();

  try {
    const payload = fresh as object;
    const expiresAt = new Date(now + ttlMs);
    await prisma.dataForSeoCache.upsert({
      where: { cacheKey },
      create: { cacheKey, endpoint, payload, expiresAt },
      update: { endpoint, payload, expiresAt, createdAt: new Date(now) },
    });
  } catch (err) {
    console.warn("[seo/dataforseo-cache] tulis cache gagal", err);
  }

  return fresh;
}

/** Hapus entri cache kedaluwarsa (dipanggil dari cron pemeliharaan, opsional). */
export async function pruneDataForSeoCache(): Promise<{ deleted: number }> {
  const res = await prisma.dataForSeoCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return { deleted: res.count };
}
