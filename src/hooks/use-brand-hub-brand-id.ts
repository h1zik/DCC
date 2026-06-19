"use client";

import { useSearchParams } from "next/navigation";

/** Reads ?brandId= from Brand Hub sub-nav for create/update scoping. */
export function useBrandHubBrandId(fallback?: string | null): string | null {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("brandId");
  if (fromUrl) return fromUrl;
  return fallback ?? null;
}

export function brandHubHref(path: string, brandId: string | null): string {
  if (!brandId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}brandId=${encodeURIComponent(brandId)}`;
}
