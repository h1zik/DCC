import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    seoSiteCrawl: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    seoCrawlIssue: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    seoCrawlPage: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
  fetchOnPageSummary: vi.fn(),
  fetchOnPagePages: vi.fn(),
  fetchLighthouseLive: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/seo/dataforseo/client", () => ({
  DataForSeoError: class DataForSeoError extends Error {
    balanceExhausted = false;
  },
  isDataForSeoConfigured: () => true,
}));
vi.mock("@/lib/seo/dataforseo/onpage", () => ({
  postOnPageCrawlTask: vi.fn(),
  fetchOnPageSummary: mocks.fetchOnPageSummary,
  fetchOnPagePages: mocks.fetchOnPagePages,
  fetchLighthouseLive: mocks.fetchLighthouseLive,
}));
vi.mock("@/lib/seo/crawler/crawl-rules", () => ({
  buildCrawlIssues: () => [],
}));
vi.mock("@/lib/seo/crawler/crawl-diff", () => ({
  diffCrawlIssues: vi.fn(),
}));
vi.mock("@/lib/seo/crawler/health-score", () => ({
  computeHealthScore: () => 100,
}));
vi.mock("@/lib/notify", () => ({ notifyUser: vi.fn() }));

import { collectCrawlResults } from "./crawler";

const finishedSummary = {
  crawlProgress: "finished",
  pagesCrawled: 16,
  pagesInQueue: 0,
  maxCrawlPages: 100,
  pageMetrics: null,
  domainInfo: null,
  domainChecks: {},
};

function crawlRow(overrides: Record<string, unknown> = {}) {
  const stale = new Date("2026-07-13T10:00:00.000Z");
  return {
    id: "crawl-1",
    name: "Test crawl",
    domain: "example.com",
    maxPages: 100,
    includeLighthouse: false,
    status: "COLLECTING",
    dataforseoTaskId: "task-1",
    pagesCrawled: 0,
    scheduleId: null,
    createdById: "user-1",
    createdAt: stale,
    updatedAt: stale,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));
  mocks.prisma.seoSiteCrawl.findFirst.mockResolvedValue(null);
  mocks.prisma.seoSiteCrawl.update.mockResolvedValue({});
  mocks.prisma.seoCrawlIssue.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.seoCrawlIssue.createMany.mockResolvedValue({ count: 0 });
  mocks.prisma.seoCrawlPage.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.seoCrawlPage.createMany.mockResolvedValue({ count: 0 });
  mocks.prisma.$transaction.mockResolvedValue([]);
  mocks.fetchOnPagePages.mockResolvedValue([]);
});

describe("collectCrawlResults timeout recovery", () => {
  it("collects a finished external task even when polling resumes after two hours", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue(finishedSummary);

    await collectCrawlResults("crawl-1");

    expect(mocks.prisma.seoSiteCrawl.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "crawl-1" },
        data: expect.objectContaining({ status: "READY", pagesCrawled: 16 }),
      }),
    );
    expect(mocks.prisma.seoSiteCrawl.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("persists healthy pages as inventory, not only URLs with issues", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue(finishedSummary);
    mocks.fetchOnPagePages.mockResolvedValue([
      {
        url: "https://example.com/healthy",
        resourceType: "html",
        statusCode: 200,
        onpageScore: 96,
        title: "Healthy page",
        description: "Complete description",
        h1Count: 1,
        wordCount: 420,
        internalLinks: 12,
        externalLinks: 1,
        inboundLinks: 4,
        imagesCount: 3,
        clickDepth: 1,
        sizeBytes: 25_000,
        loadTimeMs: 120,
        isRedirect: false,
        isBroken: false,
        fromSitemap: true,
        isHttps: true,
        checks: {},
      },
    ]);

    await collectCrawlResults("crawl-1");

    expect(mocks.prisma.seoCrawlPage.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          crawlId: "crawl-1",
          url: "https://example.com/healthy",
          statusCode: 200,
          onpageScore: 96,
          wordCount: 420,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("times out an unfinished task with no update for two hours", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue({
      ...finishedSummary,
      crawlProgress: "in_progress",
      pagesCrawled: 0,
      pagesInQueue: 10,
    });

    await collectCrawlResults("crawl-1");

    expect(mocks.prisma.seoSiteCrawl.update).toHaveBeenCalledWith({
      where: { id: "crawl-1" },
      data: {
        status: "FAILED",
        errorMessage: "Crawl melebihi batas waktu (timeout).",
      },
    });
  });

  it("uses the latest update time so refreshing an old crawl does not timeout", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(
      crawlRow({ updatedAt: new Date("2026-07-15T09:59:00.000Z") }),
    );
    mocks.fetchOnPageSummary.mockResolvedValue({
      ...finishedSummary,
      crawlProgress: "in_progress",
      pagesCrawled: 4,
      pagesInQueue: 6,
    });

    await collectCrawlResults("crawl-1");

    expect(mocks.prisma.seoSiteCrawl.update).toHaveBeenCalledWith({
      where: { id: "crawl-1" },
      data: { pagesCrawled: 4 },
    });
    expect(mocks.prisma.seoSiteCrawl.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });
});
