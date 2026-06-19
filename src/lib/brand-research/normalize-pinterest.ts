import "server-only";

export type NormalizedPinterestPin = {
  externalId: string;
  title: string | null;
  description: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  sourceUrl: string | null;
  dominantColor: string | null;
  metadata: Record<string, unknown>;
};

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function pickBestImageUrl(item: Record<string, unknown>): string | null {
  const imageUrls = item.imageUrls as Record<string, unknown> | undefined;
  if (imageUrls && typeof imageUrls === "object") {
    for (const key of ["original", "736x", "474x", "236x", "170x", "60x60"]) {
      const val = imageUrls[key];
      if (typeof val === "string" && val.startsWith("http")) return val;
    }
  }

  const images = item.images as Record<string, unknown> | undefined;
  if (images && typeof images === "object") {
    for (const key of ["orig", "original", "736x", "564x", "474x", "236x", "170x"]) {
      const val = images[key];
      if (typeof val === "string" && val.startsWith("http")) return val;
      if (val && typeof val === "object" && typeof (val as { url?: string }).url === "string") {
        return (val as { url: string }).url;
      }
    }
  }

  return pickString(item, [
    "imageUrl",
    "image_url",
    "image",
    "imageOriginalUrl",
    "image_large_url",
    "image_medium_url",
    "grid_image",
    "pinImage",
  ]);
}

export function normalizePinterestPins(
  items: Record<string, unknown>[],
): NormalizedPinterestPin[] {
  const out: NormalizedPinterestPin[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const imageUrl = pickBestImageUrl(item);
    if (!imageUrl) continue;

    const externalId =
      pickString(item, ["id", "pinId", "pin_id", "externalId"]) ?? `pin-${i}`;

    out.push({
      externalId,
      title: pickString(item, ["title", "name", "grid_title", "seo_title"]),
      description: pickString(item, [
        "description",
        "grid_description",
        "seo_description",
        "alt_text",
      ]),
      imageUrl,
      thumbnailUrl: pickString(item, ["thumbnail", "thumb", "image_small_url"]),
      sourceUrl: pickString(item, ["url", "link", "pinUrl", "pin_url"]),
      dominantColor: pickString(item, ["dominantColor", "dominant_color", "color"]),
      metadata: {
        boardName:
          pickString(item, ["boardName", "board_name"]) ??
          (item.board && typeof item.board === "object"
            ? pickString(item.board as Record<string, unknown>, ["name"])
            : null),
        likes: pickNumber(item, ["likeCount", "likes", "reaction_count", "reactions"]),
        saves: pickNumber(item, ["saveCount", "saves", "repin_count", "repinCount"]),
        comments: pickNumber(item, ["commentCount", "comments"]),
      },
    });
  }
  return out;
}

export function generateDemoPinterestPins(
  keyword: string,
  count = 12,
): NormalizedPinterestPin[] {
  const seed = keyword.trim() || "beauty";
  const n = Math.min(Math.max(Math.round(count), 1), 50);
  return Array.from({ length: n }, (_, i) => ({
    externalId: `demo-pin-${seed}-${i}`,
    title: `${seed} aesthetic reference ${i + 1}`,
    description: `Demo moodboard pin untuk ${seed}`,
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(seed)}-${i}/600/800`,
    thumbnailUrl: `https://picsum.photos/seed/${encodeURIComponent(seed)}-${i}/200/280`,
    sourceUrl: `https://www.pinterest.com/pin/demo-${i}/`,
    dominantColor: "#E8D5C4",
    metadata: { demo: true, keyword: seed },
  }));
}
