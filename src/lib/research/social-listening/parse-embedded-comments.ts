import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import type { RawSocialComment } from "@/lib/research/social-listening/social-comment-types";

function commentId(prefix: string, text: string, author: string, index: number): string {
  return `${prefix}-${index}-${author.slice(0, 20)}-${text.slice(0, 30)}`.replace(/\s+/g, "_");
}

function parseCommentText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "text" in value) {
    const text = (value as { text?: unknown }).text;
    return typeof text === "string" ? text.trim() : "";
  }
  return "";
}

function parseCommentAuthor(item: Record<string, unknown>): string | undefined {
  const user = item.user as Record<string, unknown> | undefined;
  const owner = item.owner as Record<string, unknown> | undefined;
  const candidates = [
    item.author,
    item.username,
    item.ownerUsername,
    user?.uniqueId,
    user?.nickname,
    user?.name,
    owner?.username,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

function parseCommentLikes(item: Record<string, unknown>): number {
  if (typeof item.diggCount === "number") return item.diggCount;
  if (typeof item.likes === "number") return item.likes;
  if (typeof item.likesCount === "number") return item.likesCount;
  return 0;
}

function parseCommentDate(item: Record<string, unknown>): Date | undefined {
  if (typeof item.createTime === "number") return new Date(item.createTime * 1000);
  if (typeof item.timestamp === "string") {
    const d = new Date(item.timestamp);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof item.createdAt === "string") {
    const d = new Date(item.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

function extractFromArray(
  items: unknown[],
  platform: SocialListeningPlatform,
  parentExternalId: string,
  prefix: string,
  max: number,
): RawSocialComment[] {
  const out: RawSocialComment[] = [];

  for (let i = 0; i < items.length && out.length < max; i++) {
    const raw = items[i];
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const text = parseCommentText(item.text ?? item.comment ?? item.caption);
    if (!text || text.length < 3) continue;

    const author = parseCommentAuthor(item) ?? "anon";
    out.push({
      platform,
      externalId: commentId(prefix, text, author, i),
      text,
      author,
      likes: parseCommentLikes(item),
      postedAt: parseCommentDate(item),
      parentExternalId,
    });
  }

  return out;
}

/** Pull comment texts embedded in Apify post/video items (TikTok commentsPerPost, IG latestComments). */
export function extractEmbeddedComments(
  item: Record<string, unknown>,
  platform: SocialListeningPlatform,
  parentExternalId: string,
  maxPerPost = 20,
): RawSocialComment[] {
  const prefix = `${platform}:${parentExternalId}`;

  const arrays: unknown[][] = [];
  for (const key of [
    "comments",
    "latestComments",
    "topComments",
    "commentList",
  ]) {
    const val = item[key];
    if (Array.isArray(val)) arrays.push(val);
  }

  const merged: RawSocialComment[] = [];
  for (const arr of arrays) {
    merged.push(...extractFromArray(arr, platform, parentExternalId, prefix, maxPerPost));
    if (merged.length >= maxPerPost) break;
  }

  const seen = new Set<string>();
  return merged.filter((c) => {
    const key = c.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
