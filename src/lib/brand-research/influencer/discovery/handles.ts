import { InfluencerPlatform, SocialListeningPlatform } from "@prisma/client";
import { buildProfileUrl } from "@/lib/apify/influencer-actors";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";

/**
 * Ubah hasil scrape hashtag/kata kunci menjadi daftar kreator unik.
 *
 * Ini titik balik seluruh modul: scraper mengembalikan POST, sedangkan yang
 * kita cari adalah ORANG. Satu kreator kerap muncul di banyak post dalam satu
 * crawl, dan pengulangan itu justru sinyal — bukan duplikat yang harus dibuang
 * diam-diam.
 *
 * Fungsi-fungsi di sini sengaja murni (tanpa DB, tanpa jaringan) supaya logika
 * penyaringan handle bisa diuji: salah sedikit di sini berarti puluhan akun
 * sah terbuang atau puluhan sampah masuk database.
 */

/**
 * Sama dengan pola handle di `influencer-actors.ts`.
 *
 * CATATAN: sengaja TIDAK memakai `parseInfluencerUrl()` untuk handle telanjang.
 * Fungsi itu memperlakukan input bertitik sebagai URL, sehingga username yang
 * sangat lazim di Indonesia seperti "nana.beauty" akan ditolak sebagai domain
 * asing. Di sini yang datang selalu handle telanjang dari scraper, jadi
 * validasinya harus berdiri sendiri.
 */
const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

export function normalizeDiscoveredHandle(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const handle = raw.trim().replace(/^@/, "").replace(/\/+$/, "").toLowerCase();
  if (!HANDLE_RE.test(handle)) return null;
  // "..." atau "___" lolos pola di atas tapi bukan username siapa pun.
  if (!/[a-z0-9]/.test(handle)) return null;
  return handle;
}

/**
 * Social Listening memantau lebih banyak platform daripada yang bisa diaudit.
 * Platform di luar Instagram/TikTok dilewati, bukan dipaksa masuk.
 */
export function toInfluencerPlatform(
  platform: SocialListeningPlatform,
): InfluencerPlatform | null {
  if (platform === SocialListeningPlatform.TIKTOK) {
    return InfluencerPlatform.TIKTOK;
  }
  if (platform === SocialListeningPlatform.INSTAGRAM) {
    return InfluencerPlatform.INSTAGRAM;
  }
  return null;
}

/** Buang "#", spasi, dan garis bawah supaya "skin care" cocok dengan "#skincare". */
function compact(value: string): string {
  return value.toLowerCase().replace(/^#/, "").replace(/[#_\s]/g, "");
}

/**
 * Tebak kata kunci mana yang memunculkan sebuah post.
 *
 * Scraper dipanggil dengan beberapa kata kunci sekaligus dan mengembalikan satu
 * daftar datar tanpa menyebut mana yang cocok, jadi atribusinya dipulihkan dari
 * caption — di situ hashtag-nya hampir selalu masih tertulis.
 */
export function matchDiscoveryTerm(
  caption: string,
  terms: string[],
): string | null {
  const haystack = compact(caption);
  if (!haystack) return null;

  for (const term of terms) {
    const needle = compact(term);
    if (needle && haystack.includes(needle)) return term;
  }
  return null;
}

export type DiscoveredCreator = {
  platform: InfluencerPlatform;
  handle: string;
  profileUrl: string;
  /**
   * Kata kunci yang memunculkan mereka — bisa lebih dari satu bila kreator ini
   * tertangkap di beberapa hashtag pada crawl yang sama. Banyaknya justru
   * penting: itulah yang dipakai mengurutkan relevansi.
   *
   * Bila crawl memakai beberapa kata kunci dan caption tidak memuat satu pun,
   * isinya satu entri berisi seluruh kata kunci yang dipakai — menebak salah
   * satunya akan mencatatkan atribusi yang keliru.
   */
  matchedTerms: string[];
  postUrl: string | null;
  postCaption: string | null;
  postLikes: number;
  postComments: number;
  postViews: number;
  postedAt: Date | null;
  /** Banyaknya post orang ini di crawl ini — sinyal relevansi mentah. */
  postsSeen: number;
};

/** Caption disimpan sebagai bahan klasifikasi kategori, bukan sebagai arsip. */
const MAX_CAPTION_LENGTH = 1000;

function engagementOf(creator: {
  postLikes: number;
  postComments: number;
}): number {
  return creator.postLikes + creator.postComments;
}

/**
 * Kumpulkan kreator unik dari daftar mention.
 *
 * Saat satu orang muncul di beberapa post, yang disimpan adalah post dengan
 * engagement TERTINGGI. Untuk keputusan yang sedang diambil di tahap ini —
 * "layak tidak orang ini dibayarkan enrichment?" — penampilan terbaik lebih
 * informatif daripada nilai tengah dari dua-tiga post; berapa post yang dia
 * punya tetap terekam terpisah di `postsSeen`.
 */
export function collectDiscoveredCreators(
  mentions: RawSocialMention[],
  terms: string[],
): DiscoveredCreator[] {
  const cleanTerms = terms.map((t) => t.trim()).filter(Boolean);
  // Satu kata kunci berarti atribusinya pasti — tidak perlu ditebak dari caption.
  const soleTerm = cleanTerms.length === 1 ? cleanTerms[0] : null;
  const allTerms = cleanTerms.join(", ");

  const byKey = new Map<string, DiscoveredCreator>();

  for (const mention of mentions) {
    const platform = toInfluencerPlatform(mention.platform);
    if (!platform) continue;

    const handle = normalizeDiscoveredHandle(mention.author);
    if (!handle) continue;

    const caption = mention.text ?? "";
    const term = soleTerm ?? matchDiscoveryTerm(caption, cleanTerms) ?? allTerms;

    const candidate: DiscoveredCreator = {
      platform,
      handle,
      profileUrl: buildProfileUrl(platform, handle),
      matchedTerms: [term],
      postUrl: mention.url ?? null,
      postCaption: caption ? caption.slice(0, MAX_CAPTION_LENGTH) : null,
      postLikes: Math.max(mention.likes, 0),
      postComments: Math.max(mention.comments, 0),
      postViews: Math.max(mention.views, 0),
      postedAt: mention.postedAt ?? null,
      postsSeen: 1,
    };

    const key = `${platform}:${handle}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }

    // Post terbaik yang menang, tapi seluruh kata kunci penemunya dikumpulkan:
    // membuang yang kedua akan menghapus persis sinyal yang dipakai memeringkat.
    const terms = existing.matchedTerms.includes(term)
      ? existing.matchedTerms
      : [...existing.matchedTerms, term];

    if (engagementOf(candidate) > engagementOf(existing)) {
      byKey.set(key, {
        ...candidate,
        matchedTerms: terms,
        postsSeen: existing.postsSeen + 1,
      });
    } else {
      existing.matchedTerms = terms;
      existing.postsSeen += 1;
    }
  }

  // Urutan menentukan siapa yang bertahan saat hasil dipotong batas atas, jadi
  // yang paling sering muncul didahulukan — bukan yang kebetulan di-scrape duluan.
  return [...byKey.values()].sort(
    (a, b) => b.postsSeen - a.postsSeen || engagementOf(b) - engagementOf(a),
  );
}
