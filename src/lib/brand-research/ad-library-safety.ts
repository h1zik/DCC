import type { AdRelevanceFields } from "@/lib/brand-research/ad-library-relevance";
import {
  filterAdsBySearchRelevance,
  type AdRelevanceOptions,
} from "@/lib/brand-research/ad-library-relevance";

export type AdSafetyFields = AdRelevanceFields & {
  imageUrl?: string | null;
  videoUrl?: string | null;
  pageName?: string | null;
};

/** Pola teks/URL yang mengindikasikan konten dewasa — diblokir dari Ad Library. */
const BLOCKED_TEXT_PATTERNS: RegExp[] = [
  /\b(porn|porno|porno?graph|xxx|nsfw|nude|nudes|naked|hentai|onlyfans|fansly)\b/i,
  /\b(sex|sexo|sexe|sexcam|sexchat|sexting|sexual|erotic|erotik|erotis)\b/i,
  /\b(sexy\s*chat|adult\s*(site|content|video|dating|chat|cam)|escort|callgirl|call\s*girl)\b/i,
  /\b(milf|gigolo|prostitu|hooker|brothel|stripper|striptease)\b/i,
  /\b(cam\s*girl|webcam\s*(girl|model)|hookup|one\s*night\s*stand|fwb|fuckbuddy)\b/i,
  // Indonesia / lokal
  /\b(bokep|bokeb|telanjang|bugil|mesum|cabul|esek[-\s]?esek|coli|colmek)\b/i,
  /\b(memek|kontol|ngentot|ngewe|sange|sangean|jablay|bispak|bispsk|janda\s*gatel)\b/i,
  /\b(open\s*bo|open\s*bispak|vcs|video\s*call\s*sex|sevces|booking\s*service)\b/i,
  /\b(link\s*viral|video\s*viral|viral\s*terbaru|full\s*video|full\s*album|no\s*sensor|tanpa\s*sensor)\b/i,
  /\b(situs\s*dewasa|konten\s*dewasa|18\s*\+|21\s*\+|dewasa\s*(only|saja)|17\s*tahun\s*keatas)\b/i,
  // Judi
  /\b(judi\s*online|judol|slot\s*(gacor|online|maxwin|pulsa)|maxwin|togel|toto\s*gelap|bandar\s*(togel|judi)|casino|kasino|sbobet|rtp\s*slot)\b/i,
  // Simbol/emoji dewasa
  /🔞|🍑|🍆💦|💦|🥵\s*🔞/u,
];

const BLOCKED_URL_PATTERNS: RegExp[] = [
  /\b(pornhub|xvideos|xhamster|redtube|youporn|spankbang|brazzers|onlyfans|fansly|chaturbate|stripchat|bongacams|livejasmin)\b/i,
  /\b(bokep|xxx|adult|nsfw|hentai|escort|camgirl)\b/i,
  /\b(slot|togel|judi|judol|casino|sbobet|maxwin|gacor)\b/i,
];

const BLOCKED_PAGE_CATEGORIES = new Set([
  "ADULT",
  "ADULT_CONTENT",
  "ADULT_ENTERTAINMENT",
  "DATING",
  "DATING_SERVICE",
  "GAMBLING",
  "GAMBLING_CASINO",
  "CASINO",
  "ESCORT_SERVICE",
]);

function collectAdText(ad: AdSafetyFields): string {
  const raw = ad.rawData ?? {};
  const linkCaption =
    typeof raw.ad_creative_link_captions === "object"
      ? Array.isArray(raw.ad_creative_link_captions)
        ? raw.ad_creative_link_captions.join(" ")
        : String(raw.ad_creative_link_captions)
      : "";
  const parts = [
    ad.bodyText,
    ad.linkTitle,
    ad.pageName,
    ad.linkUrl,
    linkCaption,
    ad.imageUrl,
    ad.videoUrl,
  ];
  return parts
    .filter((p): p is string => Boolean(p?.trim()))
    .join(" ");
}

function rawCategories(raw: Record<string, unknown>): string[] {
  const cats = raw.categories ?? raw.page_categories ?? raw.pageCategories;
  if (!Array.isArray(cats)) return [];
  return cats.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
}

export function isBlockedAdLibraryAd(ad: AdSafetyFields): boolean {
  const text = collectAdText(ad);
  if (BLOCKED_TEXT_PATTERNS.some((re) => re.test(text))) return true;
  if (ad.linkUrl && BLOCKED_URL_PATTERNS.some((re) => re.test(ad.linkUrl!))) {
    return true;
  }

  const raw = ad.rawData;
  if (raw && typeof raw === "object") {
    for (const cat of rawCategories(raw as Record<string, unknown>)) {
      if (BLOCKED_PAGE_CATEGORIES.has(cat)) return true;
      if (
        cat.includes("ADULT") ||
        cat.includes("ESCORT") ||
        cat.includes("DATING") ||
        cat.includes("GAMBLING") ||
        cat.includes("CASINO")
      ) {
        return true;
      }
    }
  }

  return false;
}

export function filterSafeAdLibraryAds<T extends AdSafetyFields>(ads: T[]): T[] {
  return ads.filter((ad) => !isBlockedAdLibraryAd(ad));
}

export function filterAdsForMonitorView<T extends AdSafetyFields & AdRelevanceFields>(
  ads: T[],
  monitor: {
    searchTerms: string[];
    adLibraryUrls: string[];
    searchType?: string | null;
  },
  options?: AdRelevanceOptions,
): T[] {
  let filtered = filterSafeAdLibraryAds(ads);

  if (monitor.searchTerms.length > 0 && monitor.adLibraryUrls.length === 0) {
    filtered = filterAdsBySearchRelevance(filtered, monitor.searchTerms, {
      searchType: options?.searchType ?? monitor.searchType,
    });
  }

  return filtered;
}
