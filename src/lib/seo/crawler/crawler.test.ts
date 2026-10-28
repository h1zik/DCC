import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    seoSiteCrawl: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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
  buildCrawlIssues: vi.fn(),
  diffCrawlIssues: vi.fn(),
  notifyUser: vi.fn(),
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
  buildCrawlIssues: mocks.buildCrawlIssues,
}));
vi.mock("@/lib/seo/crawler/crawl-diff", () => ({
  diffCrawlIssues: mocks.diffCrawlIssues,
}));
vi.mock("@/lib/seo/crawler/health-score", () => ({
  computeHealthScore: () => 100,
}));
vi.mock("@/lib/notify", () => ({ notifyUser: mocks.notifyUser }));

import {
  CRAWL_NO_PAGES_MESSAGE,
  CRAWL_PAGES_UNAVAILABLE_NOTICE,
  collectCrawlResults,
  isTerminalTaskStatus,
  pollRunningSiteCrawls,
  recoverStaleAnalyzingCrawls,
} from "./crawler";

const finishedSummary = {
  crawlProgress: "finished",
  pagesCrawled: 16,
  pagesInQueue: 0,
  maxCrawlPages: 100,
  pageMetrics: null,
  domainInfo: null,
  domainChecks: {},
};

const withMetrics = {
  ...finishedSummary,
  pageMetrics: {
    checks: { no_title: 2 },
    brokenLinks: 1,
    brokenResources: null,
    duplicateTitle: null,
    duplicateDescription: null,
    duplicateContent: null,
    redirectLoop: null,
    nonIndexable: null,
    linksExternal: null,
    linksInternal: null,
    onpageScore: 80,
  },
};

function ok(summary: unknown) {
  return { summary, taskStatusCode: 20000, taskStatusMessage: "Ok." };
}

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

const healthyPage = {
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
};

function lastSiteCrawlUpdateData(): Record<string, unknown> | undefined {
  const calls = mocks.prisma.seoSiteCrawl.update.mock.calls;
  return calls.length > 0 ? calls[calls.length - 1][0].data : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));
  mocks.prisma.seoSiteCrawl.findFirst.mockResolvedValue(null);
  mocks.prisma.seoSiteCrawl.findMany.mockResolvedValue([]);
  mocks.prisma.seoSiteCrawl.update.mockResolvedValue({});
  mocks.prisma.seoSiteCrawl.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.seoCrawlIssue.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.seoCrawlIssue.createMany.mockResolvedValue({ count: 0 });
  mocks.prisma.seoCrawlPage.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.seoCrawlPage.createMany.mockResolvedValue({ count: 0 });
  mocks.prisma.$transaction.mockResolvedValue([]);
  mocks.fetchOnPagePages.mockResolvedValue([]);
  mocks.buildCrawlIssues.mockReturnValue([]);
  mocks.diffCrawlIssues.mockReturnValue({
    new: 0,
    fixed: 0,
    persisting: 0,
    newIssues: [],
    fixedIssues: [],
  });
});

describe("collectCrawlResults timeout recovery", () => {
  it("collects a finished external task even when polling resumes after two hours", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue(ok(finishedSummary));

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
    mocks.fetchOnPageSummary.mockResolvedValue(ok(finishedSummary));
    mocks.fetchOnPagePages.mockResolvedValue([healthyPage]);

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
    mocks.fetchOnPageSummary.mockResolvedValue(
      ok({
        ...finishedSummary,
        crawlProgress: "in_progress",
        pagesCrawled: 0,
        pagesInQueue: 10,
      }),
    );

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
    mocks.fetchOnPageSummary.mockResolvedValue(
      ok({
        ...finishedSummary,
        crawlProgress: "in_progress",
        pagesCrawled: 4,
        pagesInQueue: 6,
      }),
    );

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

  it("also times out when the summary is still empty (task queued forever)", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue({
      summary: null,
      taskStatusCode: 40602,
      taskStatusMessage: "Task In Progress.",
    });

    await collectCrawlResults("crawl-1");

    expect(lastSiteCrawlUpdateData()).toEqual({
      status: "FAILED",
      errorMessage: "Crawl melebihi batas waktu (timeout).",
    });
  });

  it("keeps waiting on an empty summary that is still fresh", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(
      crawlRow({ updatedAt: new Date("2026-07-15T09:50:00.000Z") }),
    );
    mocks.fetchOnPageSummary.mockResolvedValue({
      summary: null,
      taskStatusCode: 40601,
      taskStatusMessage: "Task In Queue.",
    });

    await collectCrawlResults("crawl-1");

    expect(mocks.prisma.seoSiteCrawl.update).not.toHaveBeenCalled();
    expect(mocks.prisma.seoSiteCrawl.updateMany).not.toHaveBeenCalled();
  });

  it("fails immediately with the DataForSEO message on a terminal task status", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(
      crawlRow({ updatedAt: new Date("2026-07-15T09:59:00.000Z") }),
    );
    mocks.fetchOnPageSummary.mockResolvedValue({
      summary: null,
      taskStatusCode: 40401,
      taskStatusMessage: "Task Not Found.",
    });

    await collectCrawlResults("crawl-1");

    expect(lastSiteCrawlUpdateData()).toEqual({
      status: "FAILED",
      errorMessage: "DataForSEO: Task Not Found. (40401).",
    });
  });
});

describe("collectCrawlResults concurrency claim", () => {
  it("claims COLLECTING → ANALYZING atomically before collecting", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue(ok(withMetrics));

    await collectCrawlResults("crawl-1");

    expect(mocks.prisma.seoSiteCrawl.updateMany).toHaveBeenCalledWith({
      where: { id: "crawl-1", status: "COLLECTING" },
      data: { status: "ANALYZING" },
    });
    expect(mocks.fetchOnPagePages).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("stops without side effects when another process already claimed the row", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(
      crawlRow({ includeLighthouse: true }),
    );
    mocks.fetchOnPageSummary.mockResolvedValue(ok(withMetrics));
    mocks.prisma.seoSiteCrawl.updateMany.mockResolvedValue({ count: 0 });

    await collectCrawlResults("crawl-1");

    expect(mocks.fetchOnPagePages).not.toHaveBeenCalled();
    expect(mocks.fetchLighthouseLive).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.seoSiteCrawl.update).not.toHaveBeenCalled();
  });

  it("ignores rows that are not COLLECTING (ANALYZING belongs to another process)", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(
      crawlRow({ status: "ANALYZING" }),
    );

    await collectCrawlResults("crawl-1");

    expect(mocks.fetchOnPageSummary).not.toHaveBeenCalled();
  });

  it("releases the claim back to COLLECTING when finalisation throws", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue(ok(withMetrics));
    mocks.prisma.$transaction.mockRejectedValue(new Error("db down"));

    await expect(collectCrawlResults("crawl-1")).rejects.toThrow("db down");

    expect(mocks.prisma.seoSiteCrawl.updateMany).toHaveBeenLastCalledWith({
      where: { id: "crawl-1", status: "ANALYZING" },
      data: { status: "COLLECTING" },
    });
  });

  it("recoverStaleAnalyzingCrawls resets ANALYZING rows older than 20 minutes", async () => {
    mocks.prisma.seoSiteCrawl.updateMany.mockResolvedValue({ count: 2 });

    const count = await recoverStaleAnalyzingCrawls(["a", "b"]);

    expect(count).toBe(2);
    expect(mocks.prisma.seoSiteCrawl.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["a", "b"] },
        status: "ANALYZING",
        updatedAt: { lt: new Date("2026-07-15T09:40:00.000Z") },
      },
      data: { status: "COLLECTING" },
    });
  });

  it("pollRunningSiteCrawls only polls COLLECTING rows and recovers stale ANALYZING first", async () => {
    mocks.prisma.seoSiteCrawl.updateMany.mockResolvedValue({ count: 0 });

    const result = await pollRunningSiteCrawls();

    expect(result).toEqual({ checked: 0, finished: 0, recovered: 0 });
    expect(mocks.prisma.seoSiteCrawl.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "COLLECTING" }),
      }),
    );
  });
});

describe("collectCrawlResults data quality", () => {
  it("fails a crawl with zero pages instead of reporting health 100", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue(
      ok({ ...withMetrics, pagesCrawled: 0 }),
    );

    await collectCrawlResults("crawl-1");

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(lastSiteCrawlUpdateData()).toEqual(
      expect.objectContaining({
        status: "FAILED",
        healthScore: null,
        errorMessage: CRAWL_NO_PAGES_MESSAGE,
      }),
    );
  });

  it("fails when the page list cannot be fetched and the summary carries no metrics", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue(ok(finishedSummary));
    mocks.fetchOnPagePages.mockRejectedValue(new Error("502"));

    await collectCrawlResults("crawl-1");

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(lastSiteCrawlUpdateData()).toEqual(
      expect.objectContaining({
        status: "FAILED",
        healthScore: null,
        errorMessage: CRAWL_NO_PAGES_MESSAGE,
      }),
    );
  });

  it("leaves the health score null when neither metrics nor pages are available", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue(ok(finishedSummary));
    mocks.fetchOnPagePages.mockResolvedValue([]);

    await collectCrawlResults("crawl-1");

    expect(lastSiteCrawlUpdateData()).toEqual(
      expect.objectContaining({ status: "READY", healthScore: null }),
    );
  });

  it("skips the per-URL diff when the page list fetch failed (aggregate-only compare + notice)", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue(ok(withMetrics));
    mocks.fetchOnPagePages.mockRejectedValue(new Error("502"));
    mocks.buildCrawlIssues.mockReturnValue([
      { type: "no_title", severity: "HIGH", count: 2, message: "Halaman tanpa title tag." },
    ]);
    mocks.prisma.seoSiteCrawl.findFirst.mockResolvedValue({
      id: "crawl-0",
      issues: [
        { type: "no_title", url: null, severity: "HIGH", message: "x", count: 3 },
        { type: "is_4xx_code", url: "https://example.com/a", severity: "HIGH", message: "Status 404", count: 1 },
      ],
    });

    await collectCrawlResults("crawl-1");

    const [previous, current] = mocks.diffCrawlIssues.mock.calls[0];
    expect(previous.every((i: { url: string | null }) => i.url == null)).toBe(true);
    expect(current.every((i: { url: string | null }) => i.url == null)).toBe(true);
    expect(lastSiteCrawlUpdateData()).toEqual(
      expect.objectContaining({
        status: "READY",
        healthScore: 100,
        dataNotice: expect.stringContaining(CRAWL_PAGES_UNAVAILABLE_NOTICE),
      }),
    );
  });

  it("does not emit is_broken for a page already recorded as 4xx", async () => {
    mocks.prisma.seoSiteCrawl.findUnique.mockResolvedValue(crawlRow());
    mocks.fetchOnPageSummary.mockResolvedValue(ok(finishedSummary));
    mocks.fetchOnPagePages.mockResolvedValue([
      {
        ...healthyPage,
        url: "https://example.com/missing",
        statusCode: 404,
        isBroken: true,
        checks: { is_broken: true },
      },
    ]);

    await collectCrawlResults("crawl-1");

    const rows = mocks.prisma.seoCrawlIssue.createMany.mock.calls[0][0].data as {
      type: string;
      url: string | null;
    }[];
    const types = rows.filter((r) => r.url).map((r) => r.type);
    expect(types).toContain("is_4xx_code");
    expect(types).not.toContain("is_broken");
  });
});

describe("isTerminalTaskStatus", () => {
  it("treats 404xx/400xx as terminal but queue states as pending", () => {
    expect(isTerminalTaskStatus(40401)).toBe(true);
    expect(isTerminalTaskStatus(40000)).toBe(true);
    expect(isTerminalTaskStatus(40601)).toBe(false);
    expect(isTerminalTaskStatus(40602)).toBe(false);
    expect(isTerminalTaskStatus(40402)).toBe(false);
    expect(isTerminalTaskStatus(50000)).toBe(false);
    expect(isTerminalTaskStatus(20000)).toBe(false);
    expect(isTerminalTaskStatus(null)).toBe(false);
  });
});
