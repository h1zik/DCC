import "server-only";

/**
 * Actor Apify untuk Instagram dan TikTok (social listening, trend radar,
 * komentar). Keduanya punya default sehingga cukup `APIFY_API_TOKEN` untuk jalan.
 *
 * | Kebutuhan                 | Env                       | Default                   |
 * |---------------------------|---------------------------|---------------------------|
 * | Instagram post & komentar | APIFY_ACTOR_INSTAGRAM     | apify~instagram-scraper   |
 * | TikTok video & hashtag    | APIFY_ACTOR_TIKTOK_TRENDS | clockworks~tiktok-scraper |
 */
export const DEFAULT_INSTAGRAM_ACTOR = "apify~instagram-scraper";
export const DEFAULT_TIKTOK_ACTOR = "clockworks~tiktok-scraper";

export function getInstagramActorId(): string {
  return process.env.APIFY_ACTOR_INSTAGRAM?.trim() || DEFAULT_INSTAGRAM_ACTOR;
}

export function getTikTokActorId(): string {
  return process.env.APIFY_ACTOR_TIKTOK_TRENDS?.trim() || DEFAULT_TIKTOK_ACTOR;
}
