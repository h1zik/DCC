/**
 * INFLUENCER DISCOVERY DB SMOKE TEST — pra-deploy.
 *
 * Menguji jalur yang TIDAK tersentuh unit test: penulisan massal kreator hasil
 * crawl ke Postgres. Di situ letak risikonya — `createMany` di Postgres tidak
 * memulangkan id, dedup bersandar pada constraint unik, dan satu crawl yang
 * di-poll dua kali tidak boleh menggandakan apa pun.
 *
 * Self-contained: membuat run + profil dengan penanda tes, lalu membersihkan
 * semuanya. Jalankan dengan `npm run test:db`.
 * JANGAN arahkan DATABASE_URL ke database produksi.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  InfluencerDiscoverySource,
  InfluencerJobStatus,
  InfluencerPlatform,
  PrismaClient,
} from "@prisma/client";
import type { DiscoveredCreator } from "@/lib/brand-research/influencer/discovery/handles";
import { persistDiscoveredCreators } from "@/lib/brand-research/influencer/discovery/persist-creators";
import {
  getRadarStats,
  listPopulatedCategories,
  listRadarCreators,
} from "@/lib/brand-research/influencer/discovery/radar-readers";
import {
  DEFAULT_RADAR_FILTERS,
  type RadarFilterState,
} from "@/lib/brand-research/influencer/discovery/radar-query";

const prisma = new PrismaClient();

/** Awalan handle bertanda supaya pembersihan tidak pernah menyentuh data asli. */
const PREFIX = "dbsmoke.discovery.";

let runId: string;

function creator(
  handle: string,
  // `handle` sengaja tidak bisa ditimpa: awalannya yang menjaga pembersihan
  // tidak pernah menyentuh data asli.
  overrides: Omit<Partial<DiscoveredCreator>, "handle"> = {},
): DiscoveredCreator {
  const platform = overrides.platform ?? InfluencerPlatform.TIKTOK;
  const fullHandle = `${PREFIX}${handle}`;
  return {
    profileUrl:
      platform === InfluencerPlatform.TIKTOK
        ? `https://www.tiktok.com/@${fullHandle}`
        : `https://www.instagram.com/${fullHandle}/`,
    matchedTerms: ["#dbsmoke"],
    postUrl: null,
    postCaption: null,
    postLikes: 0,
    postComments: 0,
    postViews: 0,
    postedAt: null,
    postsSeen: 1,
    ...overrides,
    platform,
    handle: fullHandle,
  };
}

async function cleanup() {
  // Hit ikut terhapus lewat cascade dari kedua sisi.
  await prisma.influencerProfile.deleteMany({
    where: { handle: { startsWith: PREFIX } },
  });
  await prisma.influencerDiscoveryRun.deleteMany({
    where: { terms: { has: "#dbsmoke" } },
  });
}

beforeEach(async () => {
  await cleanup();
  const run = await prisma.influencerDiscoveryRun.create({
    data: {
      source: InfluencerDiscoverySource.HASHTAG,
      status: InfluencerJobStatus.COLLECTING,
      terms: ["#dbsmoke"],
      platforms: [],
      searchLimit: 20,
    },
    select: { id: true },
  });
  runId = run.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

async function persist(creators: DiscoveredCreator[]) {
  return persistDiscoveredCreators(
    runId,
    InfluencerDiscoverySource.HASHTAG,
    null,
    creators,
  );
}

describe("DB smoke: menyimpan kreator hasil crawl", () => {
  it("membuat profil baru beserta jejak penemuannya", async () => {
    const result = await persist([creator("satu"), creator("dua")]);

    expect(result).toEqual({ found: 2, created: 2 });

    const profiles = await prisma.influencerProfile.findMany({
      where: { handle: { startsWith: PREFIX } },
      select: { handle: true, discoverySource: true, firstSeenAt: true },
    });
    expect(profiles).toHaveLength(2);
    for (const p of profiles) {
      expect(p.discoverySource).toBe(InfluencerDiscoverySource.HASHTAG);
      expect(p.firstSeenAt).not.toBeNull();
    }

    const hits = await prisma.influencerDiscoveryHit.count({ where: { runId } });
    expect(hits).toBe(2);
  });

  it("profil dibuat tanpa pembuat manusia — crawler tidak punya satu pun", async () => {
    // Ini yang mengharuskan createdById jadi nullable. Kalau kolomnya masih
    // NOT NULL, baris ini yang akan meledak lebih dulu.
    await persist([creator("tanpa.pembuat")]);

    const profile = await prisma.influencerProfile.findFirstOrThrow({
      where: { handle: `${PREFIX}tanpa.pembuat` },
      select: { createdById: true },
    });
    expect(profile.createdById).toBeNull();
  });

  it("memakai ulang profil yang sudah ada, tidak membuat duplikat", async () => {
    await persist([creator("lama")]);
    const second = await persist([creator("lama"), creator("baru")]);

    // "lama" tetap tercatat sebagai temuan, tapi bukan profil baru.
    expect(second.created).toBe(1);

    const count = await prisma.influencerProfile.count({
      where: { handle: { startsWith: PREFIX } },
    });
    expect(count).toBe(2);
  });

  it("run yang di-poll dua kali tidak menggandakan hit", async () => {
    await persist([creator("kembar")]);
    await persist([creator("kembar")]);

    const hits = await prisma.influencerDiscoveryHit.count({ where: { runId } });
    expect(hits).toBe(1);
  });

  it("handle sama di platform berbeda adalah dua orang", async () => {
    await persist([
      creator("lintas"),
      creator("lintas", { platform: InfluencerPlatform.INSTAGRAM }),
    ]);

    const profiles = await prisma.influencerProfile.findMany({
      where: { handle: `${PREFIX}lintas` },
      select: { platform: true },
    });
    expect(profiles).toHaveLength(2);
    expect(profiles.map((p) => p.platform).sort()).toEqual([
      InfluencerPlatform.INSTAGRAM,
      InfluencerPlatform.TIKTOK,
    ]);
  });

  it("mengisi firstSeenAt profil lama yang baru tertangkap crawler", async () => {
    // Profil yang ditambahkan manual sebelum modul discovery ada.
    await prisma.influencerProfile.create({
      data: {
        platform: InfluencerPlatform.TIKTOK,
        handle: `${PREFIX}manual`,
        profileUrl: `https://www.tiktok.com/@${PREFIX}manual`,
      },
    });

    await persist([creator("manual")]);

    const profile = await prisma.influencerProfile.findFirstOrThrow({
      where: { handle: `${PREFIX}manual` },
      select: { firstSeenAt: true, discoverySource: true },
    });
    expect(profile.firstSeenAt).not.toBeNull();
    // Sumbernya TIDAK ditimpa: profil ini memang bukan temuan crawler.
    expect(profile.discoverySource).toBeNull();
  });

  it("daftar kosong tidak menyentuh database sama sekali", async () => {
    expect(await persist([])).toEqual({ found: 0, created: 0 });
    expect(
      await prisma.influencerDiscoveryHit.count({ where: { runId } }),
    ).toBe(0);
  });
});

/**
 * Query halaman peringkat.
 *
 * Bagian ini lolos typecheck tapi bisa patah saat dijalankan: mengurutkan lewat
 * jumlah relasi dan `groupBy` adalah bentuk yang hanya terbukti benar dengan
 * menembak Postgres sungguhan.
 */
describe("DB smoke: query halaman peringkat", () => {
  async function seedMeasured() {
    // "kecil" tertangkap di dua hashtag, "besar" hanya di satu → relevansi
    // "kecil" lebih tinggi meski followernya jauh lebih sedikit.
    await persist([
      creator("besar"),
      creator("kecil", { matchedTerms: ["#dbsmoke", "#dbsmoke-lain"] }),
    ]);

    await prisma.influencerProfile.updateMany({
      where: { handle: `${PREFIX}besar` },
      data: {
        latestFollowers: 500_000,
        latestEngagementRate: 1.2,
        latestTier: "MACRO",
        latestMeasuredAt: new Date(),
        category: "beauty-skincare",
        categoryConfidence: 0.9,
      },
    });
    await prisma.influencerProfile.updateMany({
      where: { handle: `${PREFIX}kecil` },
      data: {
        latestFollowers: 12_000,
        latestEngagementRate: 8.4,
        latestTier: "MICRO",
        latestMeasuredAt: new Date(),
        category: "food-beverage",
        categoryConfidence: 0.7,
      },
    });
  }

  function filters(patch: Partial<RadarFilterState> = {}): RadarFilterState {
    return { ...DEFAULT_RADAR_FILTERS, search: PREFIX, ...patch };
  }

  it("mengurutkan menurut follower, engagement, dan relevansi", async () => {
    await seedMeasured();

    const byFollowers = await listRadarCreators(filters({ sort: "followers" }));
    expect(byFollowers.rows[0].handle).toBe(`${PREFIX}besar`);

    const byEngagement = await listRadarCreators(filters({ sort: "engagement" }));
    expect(byEngagement.rows[0].handle).toBe(`${PREFIX}kecil`);

    // Relevansi = jumlah crawl yang menemukan orang ini. Bentuk orderBy lewat
    // _count relasi inilah yang paling rawan patah di runtime.
    const byRelevance = await listRadarCreators(filters({ sort: "relevance" }));
    expect(byRelevance.rows[0].handle).toBe(`${PREFIX}kecil`);
    expect(byRelevance.rows[0].discoveryCount).toBeGreaterThan(0);
  });

  it("menyaring menurut kategori, tier, dan status terukur", async () => {
    await seedMeasured();
    await persist([creator("belum.diukur")]);

    const beauty = await listRadarCreators(
      filters({ category: "beauty-skincare" }),
    );
    expect(beauty.rows.map((r) => r.handle)).toEqual([`${PREFIX}besar`]);

    const micro = await listRadarCreators(filters({ tier: "MICRO" }));
    expect(micro.rows.map((r) => r.handle)).toEqual([`${PREFIX}kecil`]);

    const unclassified = await listRadarCreators(
      filters({ category: "unclassified" }),
    );
    expect(unclassified.rows.map((r) => r.handle)).toEqual([
      `${PREFIX}belum.diukur`,
    ]);

    const measured = await listRadarCreators(filters({ measuredOnly: true }));
    expect(measured.rows).toHaveLength(2);
  });

  it("kreator belum terukur tidak menduduki puncak hanya karena nilainya kosong", async () => {
    await seedMeasured();
    await persist([creator("belum.diukur")]);

    const page = await listRadarCreators(filters({ sort: "followers" }));
    expect(page.rows.at(-1)?.handle).toBe(`${PREFIX}belum.diukur`);
  });

  it("memaginasi dan melaporkan total", async () => {
    await seedMeasured();
    const page = await listRadarCreators(filters());
    expect(page.total).toBe(2);
    expect(page.pageCount).toBe(1);
    expect(page.page).toBe(1);
  });

  it("mengelompokkan kategori yang ada isinya", async () => {
    await seedMeasured();
    const categories = await listPopulatedCategories();
    const codes = categories.map((c) => c.category);
    expect(codes).toContain("beauty-skincare");
    expect(codes).toContain("food-beverage");
  });

  it("menghitung statistik tanpa meledak", async () => {
    await seedMeasured();
    const stats = await getRadarStats();
    expect(stats.totalCreators).toBeGreaterThanOrEqual(2);
    expect(stats.measured).toBeGreaterThanOrEqual(2);
    expect(stats.runningDiscovery).toBeGreaterThanOrEqual(0);
    expect(stats.runningEnrichment).toBeGreaterThanOrEqual(0);
  });

  /**
   * Angka antrean ini muncul di tombol aksi dan mematikannya saat nol, jadi
   * kriterianya harus tetap sama dengan kriteria aksinya. Dua profil hasil
   * seed sengaja tidak punya snapshot dan tidak punya `categorySetAt` —
   * keduanya wajib terhitung sebagai pekerjaan yang tersisa.
   */
  it("menghitung antrean pengukuran dan klasifikasi", async () => {
    await seedMeasured();
    const stats = await getRadarStats();
    expect(stats.pendingMeasurement).toBeGreaterThanOrEqual(2);
    expect(stats.pendingClassification).toBeGreaterThanOrEqual(2);
  });
});
