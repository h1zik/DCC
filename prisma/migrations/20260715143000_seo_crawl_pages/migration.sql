-- Persist every page returned by a technical crawl, including healthy pages.
CREATE TABLE "SeoCrawlPage" (
    "id" TEXT NOT NULL,
    "crawlId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "resourceType" TEXT,
    "statusCode" INTEGER,
    "onpageScore" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "h1Count" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER,
    "internalLinks" INTEGER,
    "externalLinks" INTEGER,
    "inboundLinks" INTEGER,
    "imagesCount" INTEGER,
    "clickDepth" INTEGER,
    "sizeBytes" INTEGER,
    "loadTimeMs" INTEGER,
    "isRedirect" BOOLEAN NOT NULL DEFAULT false,
    "isBroken" BOOLEAN NOT NULL DEFAULT false,
    "fromSitemap" BOOLEAN NOT NULL DEFAULT false,
    "isHttps" BOOLEAN NOT NULL DEFAULT false,
    "checks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoCrawlPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoCrawlPage_crawlId_url_key" ON "SeoCrawlPage"("crawlId", "url");
CREATE INDEX "SeoCrawlPage_crawlId_statusCode_idx" ON "SeoCrawlPage"("crawlId", "statusCode");
CREATE INDEX "SeoCrawlPage_crawlId_onpageScore_idx" ON "SeoCrawlPage"("crawlId", "onpageScore");

ALTER TABLE "SeoCrawlPage"
ADD CONSTRAINT "SeoCrawlPage_crawlId_fkey"
FOREIGN KEY ("crawlId") REFERENCES "SeoSiteCrawl"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
