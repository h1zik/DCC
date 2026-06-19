import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import type { RawSocialComment } from "@/lib/research/social-listening/social-comment-types";

function demoThumbnail(seed: string, index: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(`${seed}-${index}`)}/600/800`;
}

function demoCommentsForPost(
  post: Omit<RawSocialMention, "platform">,
  platform: SocialListeningPlatform,
): RawSocialComment[] {
  const base = post.externalId;
  const samples = [
    { text: "Sama banget pengalaman ku, lengket di humid weather 😭", author: "komen_user1" },
    { text: "Ada alternatif lokal yang lebih ringan?", author: "tanya_produk" },
    { text: "Mau beli tapi takut breakout, aman nggak buat acne prone?", author: "kulit_berminyak" },
    { text: "Packaging kecil travel size dong please 🙏", author: "travel_beauty" },
  ];

  return samples.map((s, i) => ({
    platform,
    externalId: `${base}-c${i}`,
    text: s.text,
    author: s.author,
    likes: 12 + i * 8,
    parentExternalId: `${base}-${platform.toLowerCase()}-0`,
  }));
}

export function generateDemoMentions(
  keywords: string[],
  platforms: SocialListeningPlatform[],
): RawSocialMention[] {
  const seed = keywords[0] ?? "skincare";
  const now = Date.now();
  const activePlatforms =
    platforms.length > 0
      ? platforms
      : [SocialListeningPlatform.TIKTOK, SocialListeningPlatform.INSTAGRAM];

  const samples: Omit<RawSocialMention, "platform">[] = [
    {
      externalId: "demo-1",
      text: `Kok ${seed} di pasar lokal selalu lengket ya? Pengen yang cepat menyerap tapi tetap lembap.`,
      author: "beautyid_demo",
      url: "https://example.com/demo/1",
      likes: 4200,
      comments: 312,
      views: 89000,
      postedAt: new Date(now - 2 * 86400000),
      thumbnailUrl: demoThumbnail(seed, 1),
      mediaType: "video",
    },
    {
      externalId: "demo-2",
      text: `Ada rekomendasi ${seed} fragrance free untuk kulit sensitif? Susah banget cari yang aman.`,
      author: "kulitsensitif.id",
      url: "https://example.com/demo/2",
      likes: 1800,
      comments: 245,
      views: 45000,
      postedAt: new Date(now - 1 * 86400000),
      thumbnailUrl: demoThumbnail(seed, 2),
      mediaType: "image",
    },
    {
      externalId: "demo-3",
      text: `Semoga ada ${seed} dengan SPF tinggi tapi nggak whitecast di kulit sawo matang 🙏`,
      author: "glowcheck_id",
      url: "https://example.com/demo/3",
      likes: 9600,
      comments: 890,
      views: 210000,
      postedAt: new Date(now - 3 * 86400000),
      thumbnailUrl: demoThumbnail(seed, 3),
      mediaType: "video",
    },
    {
      externalId: "demo-4",
      text: `${seed} ini bagus sih, teksturnya enak dan packaging travel friendly. Worth it!`,
      author: "reviewcantik",
      url: "https://example.com/demo/4",
      likes: 3200,
      comments: 98,
      views: 67000,
      postedAt: new Date(now - 4 * 86400000),
      thumbnailUrl: demoThumbnail(seed, 4),
      mediaType: "image",
    },
    {
      externalId: "demo-5",
      text: `Kenapa ya harga ${seed} impor naik terus? Ada alternatif lokal yang setara?`,
      author: "budgetbeauty",
      url: "https://example.com/demo/5",
      likes: 5400,
      comments: 421,
      views: 120000,
      postedAt: new Date(now - 5 * 86400000),
      thumbnailUrl: demoThumbnail(seed, 5),
      mediaType: "video",
    },
    {
      externalId: "demo-6",
      text: `Tips pakai ${seed} biar hasilnya maksimal? Baru pertama kali coba kategori ini.`,
      author: "pemula.skincare",
      url: "https://example.com/demo/6",
      likes: 890,
      comments: 156,
      views: 22000,
      postedAt: new Date(now - 6 * 86400000),
      thumbnailUrl: demoThumbnail(seed, 6),
      mediaType: "image",
    },
  ];

  return samples.flatMap((sample, i) =>
    activePlatforms.map((platform) => {
      const externalId = `${sample.externalId}-${platform.toLowerCase()}-${i}`;
      return {
        ...sample,
        platform,
        externalId,
        scrapedComments: demoCommentsForPost(
          { ...sample, externalId },
          platform,
        ).map((c) => ({ ...c, parentExternalId: externalId })),
      };
    }),
  );
}
