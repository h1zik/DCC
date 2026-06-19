import "server-only";

import { readFile } from "node:fs/promises";
import {
  absolutePathFromStoredPublicPath,
} from "@/lib/upload-storage";
import type { LlmImagePart } from "@/lib/research/llm/types";

const MAX_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;

function guessMime(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  return "image/jpeg";
}

async function loadFromUploadPath(publicPath: string): Promise<LlmImagePart | null> {
  const abs = absolutePathFromStoredPublicPath(publicPath);
  if (!abs) return null;
  try {
    const buf = await readFile(abs);
    if (buf.byteLength > MAX_BYTES) return null;
    return {
      mimeType: guessMime(publicPath),
      data: buf.toString("base64"),
      label: publicPath,
    };
  } catch {
    return null;
  }
}

async function loadFromUrl(url: string): Promise<LlmImagePart | null> {
  if (url.startsWith("/uploads/")) {
    return loadFromUploadPath(url);
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || guessMime(url);
    if (!mimeType.startsWith("image/")) return null;
    return {
      mimeType,
      data: buf.toString("base64"),
      label: url.slice(0, 120),
    };
  } catch {
    return null;
  }
}

export type VisualAssetForVision = {
  id: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  tags: string[];
  collectionId: string | null;
};

/** Sample diverse visual assets for multimodal analysis. */
export function sampleVisualAssetsForVision(
  assets: VisualAssetForVision[],
  maxSamples: number,
): VisualAssetForVision[] {
  if (assets.length <= maxSamples) return assets;

  const byCollection = new Map<string, VisualAssetForVision[]>();
  for (const a of assets) {
    const key = a.collectionId ?? "_other";
    const list = byCollection.get(key) ?? [];
    list.push(a);
    byCollection.set(key, list);
  }

  const picked: VisualAssetForVision[] = [];
  const buckets = [...byCollection.values()];
  let round = 0;
  while (picked.length < maxSamples && buckets.some((b) => b.length > 0)) {
    for (const bucket of buckets) {
      const item = bucket.shift();
      if (item) picked.push(item);
      if (picked.length >= maxSamples) break;
    }
    round += 1;
    if (round > maxSamples * 2) break;
  }
  return picked;
}

export async function loadVisualImageParts(
  assets: VisualAssetForVision[],
): Promise<{ parts: LlmImagePart[]; loadedCount: number; attempted: number }> {
  const parts: LlmImagePart[] = [];
  for (const asset of assets) {
    const url = asset.thumbnailUrl || asset.imageUrl;
    const part = await loadFromUrl(url);
    if (part) {
      parts.push({
        ...part,
        label: `${asset.id}: ${asset.title ?? (asset.tags.slice(0, 3).join(", ") || "visual")}`,
      });
    }
  }
  return { parts, loadedCount: parts.length, attempted: assets.length };
}
