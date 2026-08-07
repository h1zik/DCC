import { InfluencerPlatform } from "@prisma/client";

export type NormalizedInfluencerPost = {
  externalId: string;
  url?: string;
  caption?: string;
  thumbnailUrl?: string;
  mediaType?: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  saves: number;
  postedAt?: Date;
  /** Penanda berbayar resmi dari platform (label paid partnership / isAd). */
  isSponsoredMeta?: boolean;
  /**
   * Asal post. Di Instagram, tab Reels adalah koleksi terpisah dari grid
   * profil dan berperilaku sangat berbeda: audiens bisa ramai di carousel tapi
   * sepi di Reels. Di TikTok semuanya video, jadi selalu "reels".
   */
  surface: PostSurface;
  /** Post yang dipin — sering berumur tahunan, dikeluarkan dari sampel. */
  isPinned?: boolean;
  /**
   * Pemilik akun menyembunyikan jumlah like pada post ini (Instagram
   * mengembalikan -1). Angkanya BUKAN nol — tidak diketahui. Post seperti ini
   * harus dikeluarkan dari perhitungan engagement, bukan dihitung sebagai nol,
   * karena kalau tidak akun yang menyembunyikan like akan terlihat mati.
   */
  likesHidden?: boolean;
  /**
   * Cuplikan komentar yang ikut terbawa dataset. Dipakai menilai kualitas
   * komentar (bot vs manusia). Tidak selalu ada — analisisnya wajib mundur
   * dengan anggun bila kosong.
   */
  commentSamples?: NormalizedComment[];
};

export type NormalizedComment = {
  text: string;
  author?: string;
};

export type PostSurface = "feed" | "reels";

export type NormalizedInfluencerProfile = {
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  isVerified: boolean;
  isPrivate: boolean;
  followers: number;
  following: number;
  postCount: number;
  posts: NormalizedInfluencerPost[];
};

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,_\s]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function httpUrl(value: unknown): string | undefined {
  const s = str(value);
  return s && s.startsWith("http") ? s : undefined;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** Terima ISO string, epoch detik, atau epoch milidetik. */
function toDate(value: unknown): Date | undefined {
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    // Epoch detik punya 10 digit; milidetik 13.
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function rec(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Angka yang mungkin dikembalikan sebagai -1 (Instagram memakai -1 untuk
 * "disembunyikan pemilik akun"). Dibedakan dari 0 karena keduanya berarti hal
 * yang sangat berbeda bagi penilaian.
 */
function countOrHidden(value: unknown): { count: number; hidden: boolean } {
  if (value === null || value === undefined) return { count: 0, hidden: false };
  const n = num(value);
  return n < 0 ? { count: 0, hidden: true } : { count: n, hidden: false };
}

/** Ambil teks komentar yang ikut terbawa item post, kalau ada. */
export function extractPostComments(
  raw: Record<string, unknown>,
  max = 24,
): NormalizedComment[] {
  const out: NormalizedComment[] = [];

  for (const key of ["latestComments", "comments", "topComments", "commentList"]) {
    const value = raw[key];
    // `commentsCount` sering bernama mirip; hanya array yang diproses.
    if (!Array.isArray(value)) continue;

    for (const entry of value) {
      if (out.length >= max) break;
      const item = rec(entry);
      if (!item) continue;
      const text = str(item.text) ?? str(item.comment);
      if (!text) continue;
      out.push({
        text,
        author:
          str(item.ownerUsername) ??
          str(item.username) ??
          str(rec(item.owner)?.username) ??
          str(rec(item.user)?.uniqueId),
      });
    }
    if (out.length >= max) break;
  }

  return out;
}

function normalizeInstagramPost(
  raw: Record<string, unknown>,
  surface: PostSurface,
): NormalizedInfluencerPost | null {
  const shortCode = str(raw.shortCode);
  const externalId = str(raw.id) ?? shortCode;
  if (!externalId) return null;

  // videoPlayCount lebih dekat ke "reach" daripada videoViewCount. Nama field
  // berubah beberapa kali mengikuti Instagram (plays → views), jadi semua
  // varian yang pernah dipakai actor ini dibaca dan yang terbesar diambil.
  const views = Math.max(
    num(raw.videoPlayCount),
    num(raw.videoViewCount),
    num(raw.igPlayCount),
    num(raw.playCount),
    num(raw.viewCount),
  );

  // `productType: "clips"` menandai Reels sungguhan; video biasa di grid tidak
  // memilikinya. Dipakai membetulkan surface bila post Reels ikut muncul di grid.
  const isClip = str(raw.productType) === "clips";
  const likes = countOrHidden(raw.likesCount);

  return {
    externalId,
    url: httpUrl(raw.url) ?? (shortCode ? `https://www.instagram.com/p/${shortCode}/` : undefined),
    caption: str(raw.caption),
    thumbnailUrl: httpUrl(raw.displayUrl) ?? httpUrl(raw.thumbnailUrl),
    mediaType: str(raw.type) ?? str(raw.productType),
    likes: likes.count,
    likesHidden: likes.hidden,
    comments: Math.max(num(raw.commentsCount), 0),
    shares: 0, // Instagram tidak mengekspos share count publik.
    views: Math.max(views, 0),
    saves: 0,
    postedAt: toDate(raw.timestamp),
    // Nama field yang benar adalah `paidPartnership` — dua nama lain
    // dipertahankan untuk berjaga bila actor mengubah bentuk keluarannya.
    isSponsoredMeta:
      bool(raw.paidPartnership) ||
      bool(raw.isSponsored) ||
      bool(raw.isPaidPartnership),
    surface: isClip ? "reels" : surface,
    isPinned: bool(raw.isPinned),
    commentSamples: extractPostComments(raw),
  };
}

/**
 * `apify/instagram-scraper` dengan resultsType "details" mengembalikan satu
 * objek profil berisi `latestPosts`. Kalau actor jatuh ke mode posts, item
 * datang sebagai daftar post datar — keduanya ditangani.
 */
export function normalizeInstagramProfile(
  items: Record<string, unknown>[],
  fallbackHandle: string,
): NormalizedInfluencerProfile {
  const profileItem =
    items.find((i) => Array.isArray(i.latestPosts)) ??
    items.find((i) => str(i.username)) ??
    items[0];

  if (!profileItem) {
    throw new Error(
      "Apify tidak mengembalikan data profil Instagram. Cek apakah akun ada dan tidak diblokir.",
    );
  }

  if (bool(profileItem.private)) {
    throw new Error(
      `Akun @${str(profileItem.username) ?? fallbackHandle} privat — engagement tidak bisa dihitung.`,
    );
  }

  const rawPosts = Array.isArray(profileItem.latestPosts)
    ? (profileItem.latestPosts as unknown[])
    : items.filter((i) => str(i.shortCode) || str(i.type));

  const posts = rawPosts
    .map((p) => rec(p))
    .filter((p): p is Record<string, unknown> => !!p)
    .map((p) => normalizeInstagramPost(p, "feed"))
    .filter((p): p is NormalizedInfluencerPost => !!p);

  return {
    handle: (str(profileItem.username) ?? fallbackHandle).toLowerCase(),
    displayName: str(profileItem.fullName),
    avatarUrl: httpUrl(profileItem.profilePicUrlHD) ?? httpUrl(profileItem.profilePicUrl),
    bio: str(profileItem.biography),
    isVerified: bool(profileItem.verified),
    isPrivate: false,
    followers: Math.max(num(profileItem.followersCount), 0),
    following: Math.max(num(profileItem.followsCount), 0),
    postCount: Math.max(num(profileItem.postsCount), posts.length),
    posts,
  };
}

/**
 * Dataset `resultsType: "reels"` — daftar Reels datar, tanpa objek profil.
 *
 * Inilah satu-satunya sumber view Instagram yang benar. `latestPosts` dari
 * mode `details` hanya berisi grid profil, yang isinya dikurasi pemilik akun
 * dan hitungan view-nya tidak bisa dipercaya.
 */
export function normalizeInstagramReels(
  items: Record<string, unknown>[],
): NormalizedInfluencerPost[] {
  return items
    .map((item) => normalizeInstagramPost(item, "reels"))
    .filter((p): p is NormalizedInfluencerPost => !!p);
}

/**
 * Gabungkan grid dan Reels menjadi satu daftar tanpa duplikat.
 *
 * Reels yang juga ditampilkan di grid akan muncul di kedua dataset; versi dari
 * tab Reels yang dipakai karena hitungan view-nya benar.
 */
export function mergeInstagramSurfaces(
  feedPosts: NormalizedInfluencerPost[],
  reelPosts: NormalizedInfluencerPost[],
): NormalizedInfluencerPost[] {
  const byId = new Map<string, NormalizedInfluencerPost>();
  for (const post of feedPosts) byId.set(post.externalId, post);

  for (const post of reelPosts) {
    const existing = byId.get(post.externalId);
    // Versi Reels menang untuk view, tapi dataset Reels kerap tidak membawa
    // komentar. Membuang versi grid begitu saja berarti membuang satu-satunya
    // sampel komentar yang kita punya, jadi field itu dipertahankan.
    byId.set(
      post.externalId,
      existing
        ? {
            ...post,
            commentSamples:
              post.commentSamples?.length
                ? post.commentSamples
                : existing.commentSamples,
            caption: post.caption ?? existing.caption,
            // Like tersembunyi di satu sumber tapi terbaca di sumber lain:
            // pakai angka yang benar-benar ada.
            likes: post.likesHidden ? existing.likes : post.likes,
            likesHidden: post.likesHidden ? (existing.likesHidden ?? false) : false,
          }
        : post,
    );
  }

  return [...byId.values()];
}

function normalizeTikTokPost(
  raw: Record<string, unknown>,
): NormalizedInfluencerPost | null {
  const externalId = str(raw.id) ?? str(raw.webVideoUrl);
  if (!externalId) return null;

  const videoMeta = rec(raw.videoMeta);

  return {
    externalId,
    url: httpUrl(raw.webVideoUrl),
    caption: str(raw.text),
    thumbnailUrl: httpUrl(videoMeta?.coverUrl) ?? httpUrl(videoMeta?.cover),
    mediaType: "Video",
    likes: Math.max(num(raw.diggCount), 0),
    comments: Math.max(num(raw.commentCount), 0),
    shares: Math.max(num(raw.shareCount), 0),
    views: Math.max(num(raw.playCount), 0),
    saves: Math.max(num(raw.collectCount), 0),
    postedAt: toDate(raw.createTimeISO) ?? toDate(raw.createTime),
    isSponsoredMeta: bool(raw.isAd) || bool(raw.isSponsored),
    // Di TikTok tidak ada pemisahan feed/Reels — semua konten adalah video
    // pendek dengan hitungan view, jadi seluruhnya diperlakukan sebagai video.
    surface: "reels",
    isPinned: bool(raw.isPinned),
    commentSamples: extractPostComments(raw),
  };
}

/**
 * Bentuk keluaran `apidojo/tiktok-profile-scraper` — actor cadangan.
 *
 * Dikenali dari `channel` (metadata pemilik menempel di tiap video) dan
 * `postPage`. Nama fieldnya sama sekali berbeda dari clockworks, jadi
 * normalisasinya dipisah alih-alih ditambal dengan daftar alias panjang.
 */
function isApidojoTikTokItem(item: Record<string, unknown>): boolean {
  return !!rec(item.channel) && (!!str(item.postPage) || "views" in item);
}

function normalizeApidojoTikTokPost(
  raw: Record<string, unknown>,
): NormalizedInfluencerPost | null {
  const externalId = str(raw.id) ?? str(raw.postPage);
  if (!externalId) return null;

  const video = rec(raw.video);

  return {
    externalId,
    url: httpUrl(raw.postPage),
    caption: str(raw.title),
    thumbnailUrl: httpUrl(video?.cover) ?? httpUrl(video?.thumbnail),
    mediaType: "Video",
    likes: Math.max(num(raw.likes), 0),
    comments: Math.max(num(raw.comments), 0),
    shares: Math.max(num(raw.shares), 0),
    views: Math.max(num(raw.views), 0),
    saves: Math.max(num(raw.bookmarks), 0),
    postedAt: toDate(raw.uploadedAtFormatted) ?? toDate(raw.uploadedAt),
    // Actor ini tidak mengekspos penanda iklan; deteksi berbayar jatuh ke
    // caption. Itu batas bawah, dan UI memang sudah menyampaikannya begitu.
    isSponsoredMeta: false,
    surface: "reels",
    // Diisi oleh markLeadingPinnedPosts — actor ini tidak menandainya.
    isPinned: false,
    commentSamples: extractPostComments(raw),
  };
}

/** TikTok hanya mengizinkan tiga video dipin. */
const MAX_TIKTOK_PINS = 3;

/**
 * Tandai video yang dipin dari URUTANNYA.
 *
 * TikTok menaruh video pin di paling atas profil, sebelum daftar terbaru, dan
 * actor cadangan tidak menandainya sama sekali. Tapi urutannya membocorkan
 * mereka: post pin muncul lebih dulu padahal ada post yang lebih baru di
 * bawahnya. Tanpa ini, video pin lama yang viral ikut terhitung sebagai post
 * terbaru dan merusak ritme posting.
 *
 * Profil tanpa pin urut menurun sempurna, jadi tidak ada yang tertandai.
 */
export function markLeadingPinnedPosts(
  posts: NormalizedInfluencerPost[],
): NormalizedInfluencerPost[] {
  if (posts.length < 2) return posts;

  // Sebuah post "melanggar urutan" bila ada post yang LEBIH BARU di bawahnya.
  const outOfOrder: boolean[] = new Array(posts.length).fill(false);
  let newestBelow = Number.NEGATIVE_INFINITY;
  for (let i = posts.length - 1; i >= 0; i -= 1) {
    const at = posts[i].postedAt?.getTime();
    if (at === undefined) continue;
    outOfOrder[i] = at < newestBelow;
    newestBelow = Math.max(newestBelow, at);
  }

  // Hanya deretan pelanggar di PALING DEPAN yang dianggap pin; pelanggaran di
  // tengah daftar lebih mungkin data berantakan daripada video pin.
  return posts.map((post, i) => {
    if (i >= MAX_TIKTOK_PINS || !outOfOrder[i]) return post;
    const leading = outOfOrder.slice(0, i + 1).every(Boolean);
    return leading ? { ...post, isPinned: true } : post;
  });
}

function normalizeApidojoTikTokProfile(
  items: Record<string, unknown>[],
  fallbackHandle: string,
): NormalizedInfluencerProfile {
  const videos = items.filter((i) => str(i.id) || str(i.postPage));
  const channel = rec(items.find((i) => rec(i.channel))?.channel);

  if (!channel && videos.length === 0) {
    throw new Error(
      "Actor cadangan tidak mengembalikan video. Cek apakah akun TikTok ada dan punya video publik.",
    );
  }

  const posts = markLeadingPinnedPosts(
    videos
      .map(normalizeApidojoTikTokPost)
      .filter((p): p is NormalizedInfluencerPost => !!p),
  );

  return {
    handle: (str(channel?.username) ?? fallbackHandle).toLowerCase(),
    displayName: str(channel?.name),
    avatarUrl: httpUrl(channel?.avatar),
    bio: str(channel?.bio),
    isVerified: bool(channel?.verified),
    isPrivate: false,
    followers: Math.max(num(channel?.followers), 0),
    following: Math.max(num(channel?.following), 0),
    postCount: Math.max(num(channel?.videos), posts.length),
    posts,
  };
}

/**
 * `clockworks/tiktok-scraper` mengembalikan daftar video; data follower ada di
 * `authorMeta` yang menempel pada setiap video.
 *
 * Bentuk actor cadangan dikenali dari datanya sendiri, bukan dari actor mana
 * yang dipanggil — dengan begitu mengganti actor lewat env tidak diam-diam
 * menghasilkan angka nol.
 */
export function normalizeTikTokProfile(
  items: Record<string, unknown>[],
  fallbackHandle: string,
): NormalizedInfluencerProfile {
  if (items.some(isApidojoTikTokItem)) {
    return normalizeApidojoTikTokProfile(items, fallbackHandle);
  }
  const videos = items.filter((i) => str(i.id) || str(i.webVideoUrl));
  const authorSource = items.find((i) => rec(i.authorMeta));
  const author = rec(authorSource?.authorMeta);

  if (!author && videos.length === 0) {
    // Actor memakai `error`/`errorMessage` untuk akun mati atau tidak ada.
    const notice =
      str(items[0]?.error) ??
      str(items[0]?.errorMessage) ??
      "Apify tidak mengembalikan video. Cek apakah akun TikTok ada dan punya video publik.";
    throw new Error(notice);
  }

  const posts = videos
    .map(normalizeTikTokPost)
    .filter((p): p is NormalizedInfluencerPost => !!p);

  return {
    handle: (str(author?.name) ?? fallbackHandle).toLowerCase(),
    displayName: str(author?.nickName),
    avatarUrl: httpUrl(author?.avatar),
    bio: str(author?.signature),
    isVerified: bool(author?.verified),
    isPrivate: bool(author?.privateAccount),
    followers: Math.max(num(author?.fans), 0),
    following: Math.max(num(author?.following), 0),
    postCount: Math.max(num(author?.video), posts.length),
    posts,
  };
}

export function normalizeInfluencerDataset(
  platform: InfluencerPlatform,
  items: Record<string, unknown>[],
  fallbackHandle: string,
): NormalizedInfluencerProfile {
  return platform === InfluencerPlatform.INSTAGRAM
    ? normalizeInstagramProfile(items, fallbackHandle)
    : normalizeTikTokProfile(items, fallbackHandle);
}

/**
 * Pisahkan dataset satu run BANYAK handle menjadi per-orang.
 *
 * Ini yang membedakan run batch dari run tunggal. Normalizer di atas berasumsi
 * seluruh isi dataset milik satu orang — asumsi yang benar untuk audit, dan
 * salah total untuk batch: `normalizeTikTokProfile` mengambil `authorMeta` dari
 * item mana pun yang punya, sehingga tanpa pengelompokan ini, lima puluh
 * kreator akan tercatat dengan jumlah follower orang yang kebetulan pertama.
 *
 * Handle yang diminta tapi tidak muncul di dataset TIDAK dikarang jadi entri
 * kosong — pemanggil yang memutuskan apa arti ketidakhadiran itu.
 */
export function groupInfluencerDatasetByHandle(
  platform: InfluencerPlatform,
  items: Record<string, unknown>[],
): Map<string, Record<string, unknown>[]> {
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const item of items) {
    const handle =
      platform === InfluencerPlatform.INSTAGRAM
        ? // Mode "details" memulangkan satu objek profil per URL yang diminta.
          str(item.username) ?? str(rec(item.owner)?.username)
        : // clockworks menempelkan authorMeta di tiap video; apidojo memakai channel.
          str(rec(item.authorMeta)?.name) ?? str(rec(item.channel)?.username);

    if (!handle) continue;

    const key = handle.toLowerCase();
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  return groups;
}
