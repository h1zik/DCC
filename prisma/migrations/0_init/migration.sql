-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StockLogType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('MARKET_RESEARCH', 'PRODUCT_DEVELOPMENT', 'BRAND_AND_DESIGN', 'PANEL_TESTING', 'PRODUCTION', 'PRELAUNCH', 'LAUNCH');

-- CreateEnum
CREATE TYPE "ProductVendorRole" AS ENUM ('MAKLON', 'BOTTLE', 'PACKAGING', 'RAW_MATERIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CEO', 'ADMINISTRATOR', 'LOGISTICS', 'NORMAL_USER', 'PROJECT_MANAGER', 'FINANCE', 'MARKETING', 'CREATIVE_DIRECTOR', 'BUSINESS_ANALYST', 'COPYWRITER', 'MARKET_ANALYST');

-- CreateEnum
CREATE TYPE "KanbanColumnKind" AS ENUM ('CORE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'OVERDUE', 'DONE', 'BLOCKED', 'IN_REVIEW');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_COMPLETED', 'TASK_OVERDUE', 'TASK_FILE_COMMENT_ASSIGNED', 'ROOM_DOCUMENT_COMMENT_ASSIGNED', 'CEO_APPROVAL_REQUESTED', 'PROJECT_PIPELINE_APPROVAL_REQUESTED', 'SCHEDULE_REMINDER', 'RESEARCH_ALERT');

-- CreateEnum
CREATE TYPE "ScheduleReminderKind" AS ENUM ('DAY_BEFORE', 'HOUR_BEFORE');

-- CreateEnum
CREATE TYPE "RoomWorkspaceSection" AS ENUM ('HQ', 'TEAM', 'ROOMS');

-- CreateEnum
CREATE TYPE "RoomMemberRole" AS ENUM ('ROOM_MANAGER', 'ROOM_CONTRIBUTOR', 'ROOM_PROJECT_MANAGER');

-- CreateEnum
CREATE TYPE "RoomTaskProcess" AS ENUM ('MARKET_RESEARCH', 'PRODUCT_DEVELOPMENT', 'BRAND_AND_DESIGN', 'PANEL_TESTING', 'PRE_LAUNCH', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "ContentPlanJenis" AS ENUM ('REELS', 'CAROUSEL', 'SINGLE_FEED');

-- CreateEnum
CREATE TYPE "ContentPlanUsage" AS ENUM ('AWARENESS', 'CONSIDERATION', 'CONVERSION');

-- CreateEnum
CREATE TYPE "ContentPlanStatusKerja" AS ENUM ('BARU', 'DALAM_PROSES', 'DALAM_PENINJAUAN', 'DIPUBLIKASIKAN', 'DITANGGUHKAN', 'DIJEDA');

-- CreateEnum
CREATE TYPE "ScheduleRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "TaskWorkspaceView" AS ENUM ('KANBAN', 'LIST', 'GANTT', 'CALENDAR');

-- CreateEnum
CREATE TYPE "RoomViewType" AS ENUM ('CALENDAR', 'TIMELINE', 'WIKI', 'LINKS', 'LIST', 'GLOSSARY');

-- CreateEnum
CREATE TYPE "RoomTimelineStatus" AS ENUM ('UPCOMING', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RoomListColumnType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'SELECT', 'URL');

-- CreateEnum
CREATE TYPE "FinanceLedgerType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceJournalStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "FinanceApArDocStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "FinanceSpendRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "FinanceDepreciationMethod" AS ENUM ('STRAIGHT_LINE');

-- CreateEnum
CREATE TYPE "FinanceJournalLineLinkMode" AS ENUM ('CREATE_BILL', 'PAY_BILL', 'CREATE_INVOICE', 'RECEIVE_INVOICE');

-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'SICK', 'PERMISSION');

-- CreateEnum
CREATE TYPE "ResearchMarketplace" AS ENUM ('SHOPEE', 'TOKOPEDIA', 'LAZADA', 'TIKTOK_SHOP', 'FEMALEDAILY', 'SOCIOLLA');

-- CreateEnum
CREATE TYPE "ReviewIntelSourceStatus" AS ENUM ('PENDING', 'SCRAPING', 'ANALYZING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ResearchScrapeJobType" AS ENUM ('REVIEW_SCRAPE', 'COMPETITOR_SNAPSHOT', 'COMPETITOR_PRODUCT_SNAPSHOT', 'PRODUCT_DISCOVERY', 'PINTEREST_SCRAPE', 'VISUAL_HARVEST');

-- CreateEnum
CREATE TYPE "ResearchScrapeJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ScrapeDataProvenance" AS ENUM ('VPS', 'APIFY', 'NATIVE', 'CSV', 'DEMO');

-- CreateEnum
CREATE TYPE "ReviewSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "CompetitorAlertType" AS ENUM ('PRICE_CHANGE', 'RATING_CHANGE', 'NEW_SKU', 'PROMO_DETECTED', 'NEW_ENTRANT');

-- CreateEnum
CREATE TYPE "ProductDiscoveryStatus" AS ENUM ('PENDING', 'SCRAPING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "TrendRadarStatus" AS ENUM ('PENDING', 'COLLECTING', 'ANALYZING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "TrendPhase" AS ENUM ('EMERGING', 'GROWING', 'PEAK', 'DECLINING');

-- CreateEnum
CREATE TYPE "TrendDimension" AS ENUM ('INGREDIENT', 'CLAIM', 'CATEGORY', 'FORMAT', 'BRAND');

-- CreateEnum
CREATE TYPE "KeywordIntelStatus" AS ENUM ('PENDING', 'COLLECTING', 'ANALYZING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "KeywordDigestMode" AS ENUM ('LIVE', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "TrendDigestMode" AS ENUM ('LIVE', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "TrendConfidence" AS ENUM ('HIGH', 'MED', 'LOW');

-- CreateEnum
CREATE TYPE "TrendWowStatus" AS ENUM ('NEW', 'ACCELERATING', 'STABLE', 'FADING', 'GONE');

-- CreateEnum
CREATE TYPE "TrendPhaseSource" AS ENUM ('computed', 'llm_fallback');

-- CreateEnum
CREATE TYPE "SocialListeningPlatform" AS ENUM ('TIKTOK', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "SocialListeningStatus" AS ENUM ('PENDING', 'COLLECTING', 'ANALYZING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialMentionClass" AS ENUM ('COMPLAINT', 'PRAISE', 'QUESTION', 'WISHLIST', 'RECOMMENDATION', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "UspGapStatus" AS ENUM ('PENDING', 'GATHERING', 'ANALYZING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductConceptMode" AS ENUM ('MANUAL', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "ProductConceptStatus" AS ENUM ('DRAFT', 'VALIDATING', 'READY', 'SENT_TO_RND', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductInnovationStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ResearchReportType" AS ENUM ('WEEKLY', 'CUSTOM', 'CATEGORY_DEEP_DIVE', 'COMPETITOR_BATTLE', 'TREND_BRIEF');

-- CreateEnum
CREATE TYPE "ResearchReportStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "RecStatus" AS ENUM ('OPEN', 'DISMISSED', 'CONVERTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AiFeedbackVerdict" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "RecOwner" AS ENUM ('MARKETING', 'RND', 'PRICING', 'FINANCE', 'SUPPLY', 'BRAND');

-- CreateEnum
CREATE TYPE "BrandVisualAssetSource" AS ENUM ('PINTEREST', 'COMPETITOR_LISTING', 'SOCIAL', 'META_AD', 'MANUAL');

-- CreateEnum
CREATE TYPE "BrandVisualCollectionStatus" AS ENUM ('PENDING', 'COLLECTING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "BrandStrategyStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "BrandCreativeGuidelineStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "BrandPortfolioLineRole" AS ENUM ('HERO', 'CORE', 'FLANKER', 'EXPERIMENTAL');

-- CreateEnum
CREATE TYPE "BrandAudienceStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SeoJobType" AS ENUM ('KEYWORD_RESEARCH', 'RANK_CHECK', 'ONPAGE_AUDIT', 'SITE_CRAWL', 'BACKLINK_FETCH', 'MARKETPLACE_SEO');

-- CreateEnum
CREATE TYPE "SeoJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SeoAnalysisStatus" AS ENUM ('PENDING', 'COLLECTING', 'ANALYZING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SeoKeywordIntent" AS ENUM ('INFORMATIONAL', 'COMMERCIAL', 'TRANSACTIONAL', 'NAVIGATIONAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SeoRankDevice" AS ENUM ('DESKTOP', 'MOBILE');

-- CreateEnum
CREATE TYPE "SeoIssueSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "SeoReportType" AS ENUM ('OVERVIEW', 'RANK_TRACKING', 'TECHNICAL', 'FULL');

-- CreateEnum
CREATE TYPE "ContentStudioStatus" AS ENUM ('PENDING', 'COLLECTING', 'ANALYZING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ContentIdeaFeedback" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "bio" TEXT,
    "whatsappPhone" TEXT,
    "profileBannerPreset" TEXT NOT NULL DEFAULT 'twilight',
    "profileTagline" VARCHAR(160),
    "profileAccentHex" VARCHAR(7),
    "profileBannerPattern" TEXT NOT NULL DEFAULT 'noise',
    "profileSticker" VARCHAR(24),
    "profileAvatarFrame" TEXT NOT NULL DEFAULT 'ring',
    "appThemePreset" TEXT NOT NULL DEFAULT 'original',
    "taskDefaultWorkspaceView" "TaskWorkspaceView" NOT NULL DEFAULT 'KANBAN',
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'LOGISTICS',
    "customRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomRole" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "permissionTier" "UserRole" NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "colorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bannerImage" TEXT,
    "logoImage" TEXT,
    "workspaceSection" "RoomWorkspaceSection" NOT NULL DEFAULT 'ROOMS',
    "brandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomCustomProcessPhase" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "legacyProcessKey" "RoomTaskProcess",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomCustomProcessPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomView" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" "RoomViewType" NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "subtitle" VARCHAR(160),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomCalendarEvent" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(200),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomTimelineMilestone" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "RoomTimelineStatus" NOT NULL DEFAULT 'UPCOMING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomTimelineMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomWikiPage" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomWikiPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomLinkItem" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "url" VARCHAR(800) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(80),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomLinkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomListColumn" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "type" "RoomListColumnType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomListColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomListRow" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomListRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomGlossaryEntry" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "term" VARCHAR(120) NOT NULL,
    "definition" TEXT NOT NULL,
    "examples" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomGlossaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomKanbanColumn" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomProcess" "RoomTaskProcess",
    "customProcessPhaseId" TEXT,
    "kind" "KanbanColumnKind" NOT NULL DEFAULT 'CUSTOM',
    "coreRole" "TaskStatus",
    "linkedStatus" "TaskStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomKanbanColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomContentPlanItem" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "konten" TEXT NOT NULL DEFAULT '',
    "jenisKonten" "ContentPlanJenis" NOT NULL DEFAULT 'REELS',
    "usage" "ContentPlanUsage" NOT NULL DEFAULT 'AWARENESS',
    "detailKonten" TEXT,
    "copywritingFilePath" TEXT,
    "copywritingLink" TEXT,
    "designFilePaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "designLink" TEXT,
    "picUserId" TEXT,
    "picUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "statusCopywriting" "ContentPlanStatusKerja" NOT NULL DEFAULT 'BARU',
    "statusDesign" "ContentPlanStatusKerja" NOT NULL DEFAULT 'BARU',
    "deadlineCopywriting" TIMESTAMP(3),
    "deadlineDesign" TIMESTAMP(3),
    "tanggalPosting" TIMESTAMP(3),
    "catatan" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomContentPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoomMemberRole" NOT NULL,
    "allowedRoomProcesses" "RoomTaskProcess"[] DEFAULT ARRAY[]::"RoomTaskProcess"[],
    "allowedCustomProcessPhaseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "channelId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "gifUrl" TEXT,
    "replyToId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomChannel" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "topic" VARCHAR(200),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomChannelRead" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomChannelRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "publicPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectConversation" (
    "id" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "gifUrl" TEXT,
    "replyToId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "publicPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomDocumentFolder" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomDocumentFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomDocument" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "folderId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "title" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "publicPath" TEXT NOT NULL,
    "thumbPath" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomDocumentComment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "body" TEXT NOT NULL,
    "selectedText" TEXT,
    "anchorPage" INTEGER,
    "anchorJson" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomDocumentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "sourceConceptId" TEXT,
    "currentStage" "PipelineStage" NOT NULL DEFAULT 'MARKET_RESEARCH',
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingPipelineStage" "PipelineStage",
    "pipelineStageRequestedAt" TIMESTAMP(3),
    "totalProgress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "RoomTimelineStatus" NOT NULL DEFAULT 'UPCOMING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomProcess" "RoomTaskProcess" NOT NULL DEFAULT 'MARKET_RESEARCH',
    "customProcessPhaseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "kanbanColumnId" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "isApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "vendorId" TEXT,
    "leadTimeDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "whatsappReminder3dSentAt" TIMESTAMP(3),
    "whatsappReminder1dSentAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contentPlanItemId" TEXT,
    "contentPlanJenis" "ContentPlanJenis",

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTag" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" VARCHAR(7) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTagOnTask" (
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TaskTagOnTask_pkey" PRIMARY KEY ("taskId","tagId")
);

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAttachment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "publicPath" TEXT,
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskKanbanPosition" (
    "taskId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "sortKey" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskKanbanPosition_pkey" PRIMARY KEY ("taskId","columnId")
);

-- CreateTable
CREATE TABLE "TaskAttachmentComment" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "body" TEXT NOT NULL,
    "selectedText" TEXT,
    "anchorPage" INTEGER,
    "anchorJson" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAttachmentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "picName" TEXT,
    "contact" TEXT,
    "specialty" TEXT,
    "leadTimeDays" INTEGER,
    "safetyStockDays" INTEGER NOT NULL DEFAULT 7,
    "reviewPeriodDays" INTEGER NOT NULL DEFAULT 14,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "pipelineStage" "PipelineStage" NOT NULL DEFAULT 'MARKET_RESEARCH',
    "preferredVendorId" TEXT,
    "leadTimeDaysOverride" INTEGER,
    "safetyStockDaysOverride" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVendor" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "role" "ProductVendorRole" NOT NULL DEFAULT 'MAKLON',
    "roleLabel" TEXT,
    "leadTimeDaysOverride" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "StockLogType" NOT NULL,
    "salesCategory" TEXT,
    "note" TEXT,
    "reference" TEXT,
    "vendorId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "recurrence" "ScheduleRecurrence" NOT NULL DEFAULT 'NONE',
    "recurrenceUntil" TIMESTAMP(3),
    "seriesId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ScheduleEventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleReminderSent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ScheduleReminderKind" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleReminderSent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppBranding" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL DEFAULT 'Dominatus Control Center',
    "navTitle" TEXT NOT NULL DEFAULT 'Dominatus',
    "navSubtitle" TEXT NOT NULL DEFAULT 'Control Center',
    "logoImagePath" TEXT,
    "faviconPath" TEXT,
    "pushIconPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceLedgerAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinanceLedgerType" NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "tracksCashflow" BOOLEAN NOT NULL DEFAULT false,
    "isApControl" BOOLEAN NOT NULL DEFAULT false,
    "isArControl" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceLedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceFxRate" (
    "id" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "rateToBase" DECIMAL(18,6) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceFxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceJournalEntry" (
    "id" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "memo" TEXT,
    "status" "FinanceJournalStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "entryNumber" TEXT,
    "reversesEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePeriodLock" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "lockedById" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" VARCHAR(500),

    CONSTRAINT "FinancePeriodLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceJournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "memo" TEXT,
    "debitBase" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditBase" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "amountForeign" DECIMAL(18,2),
    "fxRateSnapshot" DECIMAL(18,6),
    "brandId" TEXT,

    CONSTRAINT "FinanceJournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceJournalLineLink" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "mode" "FinanceJournalLineLinkMode" NOT NULL,
    "vendorId" TEXT,
    "partyName" TEXT,
    "partyEmail" TEXT,
    "docNumber" TEXT,
    "docDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "billId" TEXT,
    "invoiceId" TEXT,
    "createdBillId" TEXT,
    "createdInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceJournalLineLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceJournalLineAttachment" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "hash" VARCHAR(64),
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceJournalLineAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBankAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "institution" TEXT,
    "accountMask" TEXT,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "openingAsOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementImport" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "matchedJournalLineId" TEXT,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceApBill" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT NOT NULL,
    "billNumber" TEXT,
    "billDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "FinanceApArDocStatus" NOT NULL DEFAULT 'OPEN',
    "memo" TEXT,
    "brandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceApBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceApPayment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalEntryId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "FinanceApPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceArInvoice" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "FinanceApArDocStatus" NOT NULL DEFAULT 'OPEN',
    "memo" TEXT,
    "brandId" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceArInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceArPayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalEntryId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "FinanceArPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBudgetLine" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "brandId" TEXT,
    "accountId" TEXT,
    "amountLimit" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSpendRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "expenseAccountId" TEXT,
    "brandId" TEXT,
    "status" "FinanceSpendRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "payoutEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSpendRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceFixedAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "cost" DECIMAL(18,2) NOT NULL,
    "salvageValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER NOT NULL,
    "method" "FinanceDepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "assetAccountId" TEXT NOT NULL,
    "accumAccountId" TEXT NOT NULL,
    "expenseAccountId" TEXT NOT NULL,
    "accumulatedDepreciation" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "disposedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceFixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "descriptor" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AttendanceType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "todoList" TEXT,
    "completedTasks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDiscoveryQuery" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "marketplaces" "ResearchMarketplace"[],
    "productLimit" INTEGER NOT NULL DEFAULT 50,
    "status" "ProductDiscoveryStatus" NOT NULL DEFAULT 'PENDING',
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "dataProvenance" "ScrapeDataProvenance",
    "collectedAt" TIMESTAMP(3),
    "scrapeState" JSONB,
    "aiActionPlan" JSONB,
    "aiInsights" JSONB,
    "aiMeta" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDiscoveryQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDiscoveryItem" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "marketplace" "ResearchMarketplace" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "shopName" TEXT,
    "shopLocation" TEXT,
    "isOfficialShop" BOOLEAN NOT NULL DEFAULT false,
    "price" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "soldCount" INTEGER,
    "exactSold" INTEGER,
    "historicalSold" INTEGER,
    "monthlySold" INTEGER,
    "estimatedRevenue" DOUBLE PRECISION,
    "stock" INTEGER,
    "hasPromo" BOOLEAN NOT NULL DEFAULT false,
    "promoText" TEXT,
    "categoryRank" INTEGER,

    CONSTRAINT "ProductDiscoveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewIntelSource" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "competitorBrand" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL DEFAULT 'shopee',
    "marketplace" "ResearchMarketplace",
    "productUrl" TEXT NOT NULL,
    "status" "ReviewIntelSourceStatus" NOT NULL DEFAULT 'PENDING',
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "totalReviewsReported" INTEGER,
    "reviewsAccessible" INTEGER,
    "reviewsComplete" BOOLEAN,
    "lastAnalyzedAt" TIMESTAMP(3),
    "dataProvenance" "ScrapeDataProvenance",
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "brandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewIntelSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRaw" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "author" TEXT,
    "rating" DOUBLE PRECISION,
    "text" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAnalysis" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "sentiment" "ReviewSentiment" NOT NULL,
    "complaintThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "praiseThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "complaintSeverity" INTEGER,
    "demographicHints" JSONB,
    "pricePerception" TEXT,
    "repeatPurchaseSignal" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewIntelSummary" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "positivePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "neutralPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "negativePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topComplaints" JSONB NOT NULL DEFAULT '[]',
    "topPraises" JSONB NOT NULL DEFAULT '[]',
    "keywordCloud" JSONB NOT NULL DEFAULT '[]',
    "timelineBuckets" JSONB NOT NULL DEFAULT '[]',
    "gapOpportunity" TEXT,
    "aiActionPlan" JSONB,
    "severityByTheme" JSONB NOT NULL DEFAULT '[]',
    "demographics" JSONB NOT NULL DEFAULT '{}',
    "aiMeta" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewIntelSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchScrapeJob" (
    "id" TEXT NOT NULL,
    "type" "ResearchScrapeJobType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "apifyRunId" TEXT,
    "status" "ResearchScrapeJobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stepLabel" TEXT,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "currentStep" INTEGER,
    "totalSteps" INTEGER,

    CONSTRAINT "ResearchScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchCompetitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "marketplace" "ResearchMarketplace" NOT NULL,
    "shopUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dataProvenance" "ScrapeDataProvenance",
    "aiInsights" JSONB,
    "aiMeta" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSku" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "externalId" TEXT,
    "currentPrice" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "exactSold" INTEGER,
    "historicalSold" INTEGER,
    "monthlySold" INTEGER,
    "estimatedRevenue" DOUBLE PRECISION,
    "stock" INTEGER,
    "shopLocation" TEXT,
    "isOfficialShop" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSnapshot" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "skuId" TEXT,
    "price" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "exactSold" INTEGER,
    "historicalSold" INTEGER,
    "monthlySold" INTEGER,
    "estimatedRevenue" DOUBLE PRECISION,
    "stock" INTEGER,
    "hasPromo" BOOLEAN NOT NULL DEFAULT false,
    "promoText" TEXT,
    "categoryRank" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorAlert" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "type" "CompetitorAlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorProductTrack" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT,
    "brand" TEXT,
    "productUrl" TEXT NOT NULL,
    "marketplace" "ResearchMarketplace" NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Produk',
    "imageUrl" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shopName" TEXT,
    "currentPrice" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "exactSold" INTEGER,
    "historicalSold" INTEGER,
    "monthlySold" INTEGER,
    "estimatedRevenue" DOUBLE PRECISION,
    "stock" INTEGER,
    "hasPromo" BOOLEAN NOT NULL DEFAULT false,
    "promoText" TEXT,
    "description" TEXT,
    "categoryName" TEXT,
    "categoryPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currency" TEXT,
    "attributes" JSONB,
    "variations" JSONB,
    "models" JSONB,
    "ratingDistribution" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScrapedAt" TIMESTAMP(3),
    "scrapeError" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorProductTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorProductSnapshot" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "exactSold" INTEGER,
    "historicalSold" INTEGER,
    "monthlySold" INTEGER,
    "estimatedRevenue" DOUBLE PRECISION,
    "stock" INTEGER,
    "hasPromo" BOOLEAN NOT NULL DEFAULT false,
    "promoText" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorProductSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorProductAlert" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "trackId" TEXT,
    "type" "CompetitorAlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorProductAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendWatchlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dimensions" "TrendDimension"[] DEFAULT ARRAY[]::"TrendDimension"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceConfig" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendRadarUserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceConfig" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendRadarUserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendRadarDigest" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "TrendRadarStatus" NOT NULL DEFAULT 'PENDING',
    "digestMode" "TrendDigestMode" NOT NULL DEFAULT 'LIVE',
    "signalStats" JSONB,
    "dataNotice" TEXT,
    "priorDigestId" TEXT,
    "narrative" TEXT,
    "aiActionPlan" JSONB,
    "aiMeta" JSONB,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "watchlistId" TEXT,
    "sourceConfig" JSONB,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendRadarDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendRadarItem" (
    "id" TEXT NOT NULL,
    "digestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimension" "TrendDimension" NOT NULL,
    "phase" "TrendPhase" NOT NULL,
    "tmiScore" DOUBLE PRECISION,
    "score" DOUBLE PRECISION,
    "confidence" "TrendConfidence" NOT NULL DEFAULT 'MED',
    "phaseSource" "TrendPhaseSource" NOT NULL DEFAULT 'computed',
    "wowStatus" "TrendWowStatus",
    "narrative" TEXT,
    "isGlobalPipeline" BOOLEAN NOT NULL DEFAULT false,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "relatedProducts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendRadarItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendBpomSnapshot" (
    "id" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendBpomSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordIntelQuery" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "seedKeyword" TEXT,
    "marketplace" "ResearchMarketplace",
    "status" "KeywordIntelStatus" NOT NULL DEFAULT 'PENDING',
    "digestMode" "KeywordDigestMode" NOT NULL DEFAULT 'LIVE',
    "signalStats" JSONB,
    "dataNotice" TEXT,
    "volumeSource" TEXT,
    "priorQueryId" TEXT,
    "sourceConfig" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordIntelQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordIntelResult" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "keywordMatrix" JSONB NOT NULL DEFAULT '[]',
    "gapKeywords" JSONB NOT NULL DEFAULT '[]',
    "namingSuggestions" JSONB NOT NULL DEFAULT '[]',
    "copyKeywords" JSONB NOT NULL DEFAULT '{}',
    "seasonalCalendar" JSONB NOT NULL DEFAULT '[]',
    "seasonalCurves" JSONB,
    "clusters" JSONB NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "aiActionPlan" JSONB,
    "aiMeta" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordIntelResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialListeningMonitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "platforms" "SocialListeningPlatform"[] DEFAULT ARRAY[]::"SocialListeningPlatform"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tiktokSearchLimit" INTEGER NOT NULL DEFAULT 20,
    "instagramSearchLimit" INTEGER NOT NULL DEFAULT 20,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialListeningMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialListeningBatch" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" "SocialListeningStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "collectedAt" TIMESTAMP(3),
    "dataProvenance" "ScrapeDataProvenance",
    "platformStatus" JSONB NOT NULL DEFAULT '{}',
    "apifyRunIds" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialListeningBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMention" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "platform" "SocialListeningPlatform" NOT NULL,
    "externalId" TEXT,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "url" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "classification" "SocialMentionClass" NOT NULL DEFAULT 'NEUTRAL',
    "painPoint" TEXT,
    "isViral" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "thumbnailUrl" TEXT,
    "mediaType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialComment" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "mentionId" TEXT,
    "platform" "SocialListeningPlatform" NOT NULL,
    "externalId" TEXT,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "classification" "SocialMentionClass" NOT NULL DEFAULT 'NEUTRAL',
    "painPoint" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialListeningSummary" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "topPainPoints" JSONB NOT NULL DEFAULT '[]',
    "topWishlist" JSONB NOT NULL DEFAULT '[]',
    "influencers" JSONB NOT NULL DEFAULT '[]',
    "viralContent" JSONB NOT NULL DEFAULT '[]',
    "categoryBreakdown" JSONB NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "aiActionPlan" JSONB,
    "aiMeta" JSONB,
    "sentimentTimeline" JSONB NOT NULL DEFAULT '[]',
    "topCommentPainPoints" JSONB NOT NULL DEFAULT '[]',
    "topCommentWishlist" JSONB NOT NULL DEFAULT '[]',
    "commentCategoryBreakdown" JSONB NOT NULL DEFAULT '[]',
    "commentAiSummary" TEXT,
    "engagementInsights" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialListeningSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UspGapAnalysis" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brandId" TEXT,
    "contextModules" JSONB NOT NULL DEFAULT '{}',
    "status" "UspGapStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UspGapAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UspGapResult" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "gapMatrix" JSONB NOT NULL DEFAULT '[]',
    "claimAnalysis" JSONB NOT NULL DEFAULT '{}',
    "positioningMap" JSONB NOT NULL DEFAULT '{}',
    "uspCandidates" JSONB NOT NULL DEFAULT '[]',
    "differentiationScore" DOUBLE PRECISION,
    "aiSummary" TEXT,
    "aiActionPlan" JSONB,
    "categoryDecision" JSONB,
    "aiMeta" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UspGapResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductConcept" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "targetMarket" TEXT,
    "priceTargetMin" DOUBLE PRECISION,
    "priceTargetMax" DOUBLE PRECISION,
    "mode" "ProductConceptMode" NOT NULL DEFAULT 'MANUAL',
    "status" "ProductConceptStatus" NOT NULL DEFAULT 'DRAFT',
    "brandId" TEXT,
    "uspGapAnalysisId" TEXT,
    "uspIndex" INTEGER,
    "sourceModules" JSONB NOT NULL DEFAULT '{}',
    "conceptData" JSONB NOT NULL DEFAULT '{}',
    "validationScores" JSONB NOT NULL DEFAULT '{}',
    "riskFactors" JSONB NOT NULL DEFAULT '[]',
    "aiMeta" JSONB,
    "createdById" TEXT NOT NULL,
    "sentToRdAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductInnovation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "baseProduct" TEXT NOT NULL,
    "targetMarket" TEXT,
    "priceTargetMin" DOUBLE PRECISION,
    "priceTargetMax" DOUBLE PRECISION,
    "baseConceptId" TEXT,
    "brandId" TEXT,
    "status" "ProductInnovationStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceModules" JSONB NOT NULL DEFAULT '{}',
    "ideas" JSONB NOT NULL DEFAULT '[]',
    "riskFactors" JSONB NOT NULL DEFAULT '[]',
    "evidenceSnapshot" JSONB NOT NULL DEFAULT '{}',
    "aiMeta" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInnovation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ResearchReportType" NOT NULL,
    "status" "ResearchReportStatus" NOT NULL DEFAULT 'PENDING',
    "config" JSONB NOT NULL DEFAULT '{}',
    "sections" JSONB NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "actionItems" JSONB NOT NULL DEFAULT '[]',
    "feedbackLoop" JSONB,
    "metrics" JSONB,
    "aiMeta" JSONB,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "errorMessage" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchReportRevision" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "actionItems" JSONB NOT NULL DEFAULT '[]',
    "metrics" JSONB,
    "aiMeta" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchReportRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchCronRun" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "detail" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ResearchCronRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiOutputFeedback" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "verdict" "AiFeedbackVerdict" NOT NULL,
    "note" TEXT,
    "aiMeta" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiOutputFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchRecommendation" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceLabel" TEXT,
    "href" TEXT,
    "owner" "RecOwner" NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'P1',
    "action" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "expectedImpact" TEXT,
    "metricToWatch" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "effort" TEXT NOT NULL DEFAULT 'MED',
    "horizon" TEXT NOT NULL DEFAULT '30D',
    "status" "RecStatus" NOT NULL DEFAULT 'OPEN',
    "convertedToTaskId" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCompetitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "marketplace" "ResearchMarketplace" NOT NULL,
    "shopUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "aiInsights" JSONB,
    "aiMeta" JSONB,
    "createdById" TEXT NOT NULL,
    "ownerBrandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCompetitorSku" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "externalId" TEXT,
    "currentPrice" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "exactSold" INTEGER,
    "historicalSold" INTEGER,
    "monthlySold" INTEGER,
    "estimatedRevenue" DOUBLE PRECISION,
    "stock" INTEGER,
    "shopLocation" TEXT,
    "isOfficialShop" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCompetitorSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCompetitorSnapshot" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "skuId" TEXT,
    "price" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "exactSold" INTEGER,
    "historicalSold" INTEGER,
    "monthlySold" INTEGER,
    "estimatedRevenue" DOUBLE PRECISION,
    "stock" INTEGER,
    "hasPromo" BOOLEAN NOT NULL DEFAULT false,
    "promoText" TEXT,
    "categoryRank" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCompetitorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCompetitorAlert" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "type" "CompetitorAlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCompetitorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandReviewSource" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "competitorBrand" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL DEFAULT 'shopee',
    "marketplace" "ResearchMarketplace",
    "productUrl" TEXT NOT NULL,
    "status" "ReviewIntelSourceStatus" NOT NULL DEFAULT 'PENDING',
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "totalReviewsReported" INTEGER,
    "reviewsAccessible" INTEGER,
    "reviewsComplete" BOOLEAN,
    "lastAnalyzedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "ownerBrandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandReviewSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandReviewItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "author" TEXT,
    "rating" DOUBLE PRECISION,
    "text" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandReviewAnalysis" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "sentiment" "ReviewSentiment" NOT NULL,
    "complaintThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "praiseThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "complaintSeverity" INTEGER,
    "demographicHints" JSONB,
    "pricePerception" TEXT,
    "repeatPurchaseSignal" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandReviewAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandReviewSummary" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "positivePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "neutralPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "negativePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topComplaints" JSONB NOT NULL DEFAULT '[]',
    "topPraises" JSONB NOT NULL DEFAULT '[]',
    "keywordCloud" JSONB NOT NULL DEFAULT '[]',
    "timelineBuckets" JSONB NOT NULL DEFAULT '[]',
    "gapOpportunity" TEXT,
    "aiActionPlan" JSONB,
    "severityByTheme" JSONB NOT NULL DEFAULT '[]',
    "demographics" JSONB NOT NULL DEFAULT '{}',
    "aiMeta" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandReviewSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandTrendDigest" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "TrendRadarStatus" NOT NULL DEFAULT 'PENDING',
    "digestMode" "TrendDigestMode" NOT NULL DEFAULT 'LIVE',
    "signalStats" JSONB,
    "dataNotice" TEXT,
    "priorDigestId" TEXT,
    "narrative" TEXT,
    "aiActionPlan" JSONB,
    "aiMeta" JSONB,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "ownerBrandId" TEXT,
    "sourceConfig" JSONB,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandTrendDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandTrendSignal" (
    "id" TEXT NOT NULL,
    "digestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimension" "TrendDimension" NOT NULL,
    "phase" "TrendPhase" NOT NULL,
    "tmiScore" DOUBLE PRECISION,
    "score" DOUBLE PRECISION,
    "confidence" "TrendConfidence" NOT NULL DEFAULT 'MED',
    "phaseSource" "TrendPhaseSource" NOT NULL DEFAULT 'computed',
    "wowStatus" "TrendWowStatus",
    "narrative" TEXT,
    "isGlobalPipeline" BOOLEAN NOT NULL DEFAULT false,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "relatedProducts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandTrendSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandKeywordQuery" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "seedKeyword" TEXT,
    "marketplace" "ResearchMarketplace",
    "status" "KeywordIntelStatus" NOT NULL DEFAULT 'PENDING',
    "digestMode" "KeywordDigestMode" NOT NULL DEFAULT 'LIVE',
    "signalStats" JSONB,
    "dataNotice" TEXT,
    "volumeSource" TEXT,
    "priorQueryId" TEXT,
    "sourceConfig" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "ownerBrandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandKeywordQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandKeywordResult" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "keywordMatrix" JSONB NOT NULL DEFAULT '[]',
    "gapKeywords" JSONB NOT NULL DEFAULT '[]',
    "namingSuggestions" JSONB NOT NULL DEFAULT '[]',
    "copyKeywords" JSONB NOT NULL DEFAULT '{}',
    "seasonalCalendar" JSONB NOT NULL DEFAULT '[]',
    "seasonalCurves" JSONB,
    "clusters" JSONB NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "aiActionPlan" JSONB,
    "aiMeta" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandKeywordResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSocialMonitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "platforms" "SocialListeningPlatform"[] DEFAULT ARRAY[]::"SocialListeningPlatform"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tiktokSearchLimit" INTEGER NOT NULL DEFAULT 20,
    "instagramSearchLimit" INTEGER NOT NULL DEFAULT 20,
    "createdById" TEXT NOT NULL,
    "ownerBrandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandSocialMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSocialBatch" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" "SocialListeningStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "collectedAt" TIMESTAMP(3),
    "platformStatus" JSONB NOT NULL DEFAULT '{}',
    "apifyRunIds" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandSocialBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSocialMention" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "platform" "SocialListeningPlatform" NOT NULL,
    "externalId" TEXT,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "url" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "classification" "SocialMentionClass" NOT NULL DEFAULT 'NEUTRAL',
    "painPoint" TEXT,
    "isViral" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "thumbnailUrl" TEXT,
    "mediaType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandSocialMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSocialSummary" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "topPainPoints" JSONB NOT NULL DEFAULT '[]',
    "topWishlist" JSONB NOT NULL DEFAULT '[]',
    "influencers" JSONB NOT NULL DEFAULT '[]',
    "viralContent" JSONB NOT NULL DEFAULT '[]',
    "categoryBreakdown" JSONB NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "aiActionPlan" JSONB,
    "aiMeta" JSONB,
    "sentimentTimeline" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandSocialSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAdLibraryMonitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adLibraryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "country" TEXT NOT NULL DEFAULT 'ID',
    "activeStatus" TEXT NOT NULL DEFAULT 'active',
    "adType" TEXT NOT NULL DEFAULT 'all',
    "mediaType" TEXT NOT NULL DEFAULT 'all',
    "searchType" TEXT NOT NULL DEFAULT 'keyword_unordered',
    "maxAds" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "aiSummary" TEXT,
    "aiInsights" JSONB,
    "ownerBrandId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAdLibraryMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAdLibraryBatch" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" "SocialListeningStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "apifyRunId" TEXT,
    "collectedAt" TIMESTAMP(3),
    "adCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandAdLibraryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAdLibraryAd" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "batchId" TEXT,
    "externalId" TEXT NOT NULL,
    "pageId" TEXT,
    "pageName" TEXT,
    "pageProfileUrl" TEXT,
    "bodyText" TEXT,
    "linkTitle" TEXT,
    "linkUrl" TEXT,
    "ctaType" TEXT,
    "ctaText" TEXT,
    "mediaType" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "snapshotUrl" TEXT,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deliveryStart" TIMESTAMP(3),
    "deliveryStop" TIMESTAMP(3),
    "linkDescription" TEXT,
    "linkCaption" TEXT,
    "collationCount" INTEGER,
    "pageLikeCount" INTEGER,
    "pageCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pageCreationDate" TEXT,
    "totalActiveAds" INTEGER,
    "audienceLower" INTEGER,
    "audienceUpper" INTEGER,
    "spendLower" INTEGER,
    "spendUpper" INTEGER,
    "currency" TEXT,
    "cards" JSONB,
    "winningScore" INTEGER,
    "rawData" JSONB,
    "scrapedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAdLibraryAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandUspAnalysis" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ownerBrandId" TEXT,
    "contextModules" JSONB NOT NULL DEFAULT '{}',
    "status" "UspGapStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandUspAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandUspResult" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "gapMatrix" JSONB NOT NULL DEFAULT '[]',
    "claimAnalysis" JSONB NOT NULL DEFAULT '{}',
    "positioningMap" JSONB NOT NULL DEFAULT '{}',
    "uspCandidates" JSONB NOT NULL DEFAULT '[]',
    "differentiationScore" DOUBLE PRECISION,
    "aiSummary" TEXT,
    "aiActionPlan" JSONB,
    "categoryDecision" JSONB,
    "aiMeta" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandUspResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandResearchScrapeJob" (
    "id" TEXT NOT NULL,
    "type" "ResearchScrapeJobType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "apifyRunId" TEXT,
    "status" "ResearchScrapeJobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stepLabel" TEXT,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "currentStep" INTEGER,
    "totalSteps" INTEGER,

    CONSTRAINT "BrandResearchScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandVisualCollection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxPinsPerKeyword" INTEGER,
    "status" "BrandVisualCollectionStatus" NOT NULL DEFAULT 'PENDING',
    "sourceConfig" JSONB,
    "errorMessage" TEXT,
    "ownerBrandId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandVisualCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandVisualAsset" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT,
    "ownerBrandId" TEXT,
    "source" "BrandVisualAssetSource" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "title" TEXT,
    "description" TEXT,
    "sourceUrl" TEXT,
    "externalId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aestheticTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dominantColors" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandVisualAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandPortfolio" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "summary" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandPortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandPortfolioLine" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "targetAudience" TEXT,
    "role" "BrandPortfolioLineRole",
    "productDiscoveryQueryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandPortfolioLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandStrategyDocument" (
    "id" TEXT NOT NULL,
    "ownerBrandId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "BrandStrategyStatus" NOT NULL DEFAULT 'DRAFT',
    "productLineStrategy" JSONB NOT NULL DEFAULT '[]',
    "category" TEXT,
    "pmBrief" TEXT,
    "brandPurpose" TEXT,
    "brandEssence" TEXT,
    "coreMessage" TEXT,
    "brandUsp" TEXT,
    "stp" JSONB,
    "brandPersonality" JSONB,
    "toneOfVoice" JSONB,
    "strategicTensions" JSONB NOT NULL DEFAULT '[]',
    "insightMemo" JSONB,
    "actionPlan" JSONB,
    "citationQuality" JSONB,
    "evidenceRefs" JSONB NOT NULL DEFAULT '[]',
    "generationConfig" JSONB NOT NULL DEFAULT '{}',
    "strategyRationales" JSONB NOT NULL DEFAULT '[]',
    "evidenceSnapshot" JSONB NOT NULL DEFAULT '{}',
    "aiMeta" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandStrategyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAudienceProfile" (
    "id" TEXT NOT NULL,
    "ownerBrandId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "BrandAudienceStatus" NOT NULL DEFAULT 'DRAFT',
    "category" TEXT,
    "pmBrief" TEXT,
    "personas" JSONB NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "actionPlan" JSONB,
    "generationConfig" JSONB NOT NULL DEFAULT '{}',
    "evidenceSnapshot" JSONB NOT NULL DEFAULT '{}',
    "evidenceRefs" JSONB NOT NULL DEFAULT '[]',
    "aiMeta" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAudienceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCreativeGuideline" (
    "id" TEXT NOT NULL,
    "strategyDocumentId" TEXT,
    "ownerBrandId" TEXT,
    "status" "BrandCreativeGuidelineStatus" NOT NULL DEFAULT 'PENDING',
    "moodboardAssetIds" JSONB NOT NULL DEFAULT '[]',
    "colorPalette" JSONB,
    "typography" JSONB,
    "designReferences" JSONB NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "aiMeta" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandCreativeGuideline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataForSeoCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataForSeoCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoJob" (
    "id" TEXT NOT NULL,
    "type" "SeoJobType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "SeoJobStatus" NOT NULL DEFAULT 'PENDING',
    "dataforseoTaskId" TEXT,
    "error" TEXT,
    "stepLabel" TEXT,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKeywordProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "seedKeyword" TEXT NOT NULL,
    "marketplace" "ResearchMarketplace",
    "locationCode" INTEGER NOT NULL DEFAULT 2360,
    "languageCode" TEXT NOT NULL DEFAULT 'id',
    "status" "SeoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "dataNotice" TEXT,
    "aiSummary" TEXT,
    "aiMeta" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoKeywordProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKeyword" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "searchVolume" INTEGER,
    "cpc" DOUBLE PRECISION,
    "competition" DOUBLE PRECISION,
    "difficulty" INTEGER,
    "intent" "SeoKeywordIntent" NOT NULL DEFAULT 'UNKNOWN',
    "clusterLabel" TEXT,
    "serpFeatures" JSONB,
    "monthlyTrend" JSONB,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoRankProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL DEFAULT 2360,
    "languageCode" TEXT NOT NULL DEFAULT 'id',
    "device" "SeoRankDevice" NOT NULL DEFAULT 'MOBILE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoRankProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoTrackedKeyword" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "targetUrl" TEXT,
    "lastPosition" INTEGER,
    "previousPosition" INTEGER,
    "lastFoundUrl" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoTrackedKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoRankSnapshot" (
    "id" TEXT NOT NULL,
    "trackedKeywordId" TEXT NOT NULL,
    "position" INTEGER,
    "foundUrl" TEXT,
    "serpFeatures" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoRankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoOnPageAudit" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "targetKeyword" TEXT,
    "status" "SeoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "signals" JSONB,
    "headings" JSONB,
    "issues" JSONB,
    "aiRecommendations" JSONB,
    "aiMeta" JSONB,
    "dataNotice" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoOnPageAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoSiteCrawl" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "maxPages" INTEGER NOT NULL DEFAULT 100,
    "includeLighthouse" BOOLEAN NOT NULL DEFAULT false,
    "status" "SeoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "dataforseoTaskId" TEXT,
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "lighthouse" JSONB,
    "dataNotice" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoSiteCrawl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoCrawlIssue" (
    "id" TEXT NOT NULL,
    "crawlId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "SeoIssueSeverity" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "url" TEXT,
    "message" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoCrawlIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoBacklinkProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" "SeoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "summary" JSONB,
    "topReferringDomains" JSONB,
    "topAnchors" JSONB,
    "history" JSONB,
    "dataNotice" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoBacklinkProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoBacklinkSnapshot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "referringDomains" INTEGER NOT NULL DEFAULT 0,
    "backlinks" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoBacklinkSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoBacklinkGap" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "competitor" TEXT NOT NULL,
    "status" "SeoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "gapDomains" JSONB,
    "gapCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoBacklinkGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoContentBrief" (
    "id" TEXT NOT NULL,
    "targetKeyword" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SeoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "relatedKeywords" JSONB,
    "outline" JSONB,
    "aiSummary" TEXT,
    "aiMeta" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoContentBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoContentDraft" (
    "id" TEXT NOT NULL,
    "briefId" TEXT,
    "title" TEXT NOT NULL,
    "targetKeyword" TEXT,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "analysis" JSONB,
    "score" INTEGER,
    "aiMeta" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoMarketplaceAnalysis" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "marketplace" "ResearchMarketplace" NOT NULL,
    "ownTitle" TEXT,
    "status" "SeoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "listingStats" JSONB,
    "titlePatterns" JSONB,
    "topListings" JSONB,
    "optimizationScore" INTEGER,
    "recommendations" JSONB,
    "aiMeta" JSONB,
    "dataNotice" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoMarketplaceAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "SeoReportType" NOT NULL DEFAULT 'OVERVIEW',
    "status" "SeoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "config" JSONB,
    "sections" JSONB,
    "aiSummary" TEXT,
    "metrics" JSONB,
    "aiMeta" JSONB,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoContentTopicRun" (
    "id" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "status" "SeoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "suggestions" JSONB,
    "dataNotice" TEXT,
    "aiMeta" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoContentTopicRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentStudioIdeaSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerBrandId" TEXT,
    "topic" TEXT NOT NULL,
    "goal" TEXT,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ContentStudioStatus" NOT NULL DEFAULT 'PENDING',
    "groundingSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dataNotice" TEXT,
    "aiSummary" TEXT,
    "aiMeta" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentStudioIdeaSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentStudioIdea" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "ownerBrandId" TEXT,
    "title" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "format" TEXT,
    "hook" TEXT,
    "platform" TEXT,
    "cta" TEXT,
    "citations" JSONB,
    "score" INTEGER,
    "feedback" "ContentIdeaFeedback",
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentStudioIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_customRoleId_idx" ON "User"("customRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_name_key" ON "CustomRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_slug_key" ON "CustomRole"("slug");

-- CreateIndex
CREATE INDEX "CustomRole_permissionTier_idx" ON "CustomRole"("permissionTier");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "RoomCustomProcessPhase_roomId_sortOrder_idx" ON "RoomCustomProcessPhase"("roomId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoomCustomProcessPhase_roomId_legacyProcessKey_key" ON "RoomCustomProcessPhase"("roomId", "legacyProcessKey");

-- CreateIndex
CREATE INDEX "RoomView_roomId_sortOrder_idx" ON "RoomView"("roomId", "sortOrder");

-- CreateIndex
CREATE INDEX "RoomCalendarEvent_viewId_startsAt_idx" ON "RoomCalendarEvent"("viewId", "startsAt");

-- CreateIndex
CREATE INDEX "RoomTimelineMilestone_viewId_date_idx" ON "RoomTimelineMilestone"("viewId", "date");

-- CreateIndex
CREATE INDEX "RoomWikiPage_viewId_sortOrder_idx" ON "RoomWikiPage"("viewId", "sortOrder");

-- CreateIndex
CREATE INDEX "RoomLinkItem_viewId_sortOrder_idx" ON "RoomLinkItem"("viewId", "sortOrder");

-- CreateIndex
CREATE INDEX "RoomListColumn_viewId_sortOrder_idx" ON "RoomListColumn"("viewId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoomListColumn_viewId_key_key" ON "RoomListColumn"("viewId", "key");

-- CreateIndex
CREATE INDEX "RoomListRow_viewId_sortOrder_idx" ON "RoomListRow"("viewId", "sortOrder");

-- CreateIndex
CREATE INDEX "RoomGlossaryEntry_viewId_term_idx" ON "RoomGlossaryEntry"("viewId", "term");

-- CreateIndex
CREATE INDEX "RoomKanbanColumn_roomId_roomProcess_sortOrder_idx" ON "RoomKanbanColumn"("roomId", "roomProcess", "sortOrder");

-- CreateIndex
CREATE INDEX "RoomKanbanColumn_roomId_customProcessPhaseId_sortOrder_idx" ON "RoomKanbanColumn"("roomId", "customProcessPhaseId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoomKanbanColumn_roomId_roomProcess_customProcessPhaseId_co_key" ON "RoomKanbanColumn"("roomId", "roomProcess", "customProcessPhaseId", "coreRole");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_userId_key" ON "RoomMember"("roomId", "userId");

-- CreateIndex
CREATE INDEX "RoomMessage_roomId_createdAt_idx" ON "RoomMessage"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "RoomMessage_roomId_updatedAt_idx" ON "RoomMessage"("roomId", "updatedAt");

-- CreateIndex
CREATE INDEX "RoomMessage_channelId_createdAt_idx" ON "RoomMessage"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "RoomMessage_channelId_updatedAt_idx" ON "RoomMessage"("channelId", "updatedAt");

-- CreateIndex
CREATE INDEX "RoomMessage_replyToId_idx" ON "RoomMessage"("replyToId");

-- CreateIndex
CREATE INDEX "RoomChannel_roomId_sortOrder_idx" ON "RoomChannel"("roomId", "sortOrder");

-- CreateIndex
CREATE INDEX "RoomChannelRead_userId_idx" ON "RoomChannelRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomChannelRead_channelId_userId_key" ON "RoomChannelRead"("channelId", "userId");

-- CreateIndex
CREATE INDEX "RoomMessageAttachment_messageId_idx" ON "RoomMessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "DirectConversation_lastMessageAt_idx" ON "DirectConversation"("lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "DirectConversationMember_userId_idx" ON "DirectConversationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversationMember_conversationId_userId_key" ON "DirectConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_updatedAt_idx" ON "DirectMessage"("conversationId", "updatedAt");

-- CreateIndex
CREATE INDEX "DirectMessage_replyToId_idx" ON "DirectMessage"("replyToId");

-- CreateIndex
CREATE INDEX "DirectMessageAttachment_messageId_idx" ON "DirectMessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "RoomDocumentFolder_roomId_parentId_sortOrder_idx" ON "RoomDocumentFolder"("roomId", "parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoomDocumentFolder_roomId_parentId_name_key" ON "RoomDocumentFolder"("roomId", "parentId", "name");

-- CreateIndex
CREATE INDEX "RoomDocument_roomId_folderId_idx" ON "RoomDocument"("roomId", "folderId");

-- CreateIndex
CREATE INDEX "RoomDocument_roomId_createdAt_idx" ON "RoomDocument"("roomId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RoomDocument_roomId_folderId_createdAt_idx" ON "RoomDocument"("roomId", "folderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RoomDocumentComment_documentId_createdAt_idx" ON "RoomDocumentComment"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "RoomDocumentComment_assigneeId_resolvedAt_idx" ON "RoomDocumentComment"("assigneeId", "resolvedAt");

-- CreateIndex
CREATE INDEX "ProjectMilestone_projectId_parentId_sortOrder_idx" ON "ProjectMilestone"("projectId", "parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "Task_projectId_roomProcess_archivedAt_sortOrder_idx" ON "Task"("projectId", "roomProcess", "archivedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "Task_projectId_customProcessPhaseId_archivedAt_sortOrder_idx" ON "Task"("projectId", "customProcessPhaseId", "archivedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "Task_projectId_archivedAt_status_idx" ON "Task"("projectId", "archivedAt", "status");

-- CreateIndex
CREATE INDEX "Task_projectId_createdAt_idx" ON "Task"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_contentPlanItemId_idx" ON "Task"("contentPlanItemId");

-- CreateIndex
CREATE INDEX "Task_kanbanColumnId_idx" ON "Task"("kanbanColumnId");

-- CreateIndex
CREATE INDEX "TaskTag_roomId_createdAt_idx" ON "TaskTag"("roomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTag_roomId_name_key" ON "TaskTag"("roomId", "name");

-- CreateIndex
CREATE INDEX "TaskTagOnTask_tagId_idx" ON "TaskTagOnTask"("tagId");

-- CreateIndex
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskAttachment_taskId_createdAt_idx" ON "TaskAttachment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskKanbanPosition_columnId_sortKey_idx" ON "TaskKanbanPosition"("columnId", "sortKey");

-- CreateIndex
CREATE INDEX "TaskAttachmentComment_attachmentId_createdAt_idx" ON "TaskAttachmentComment"("attachmentId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskAttachmentComment_assigneeId_resolvedAt_idx" ON "TaskAttachmentComment"("assigneeId", "resolvedAt");

-- CreateIndex
CREATE INDEX "TaskChecklistItem_taskId_sortOrder_idx" ON "TaskChecklistItem"("taskId", "sortOrder");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_preferredVendorId_idx" ON "Product"("preferredVendorId");

-- CreateIndex
CREATE INDEX "ProductVendor_productId_idx" ON "ProductVendor"("productId");

-- CreateIndex
CREATE INDEX "ProductVendor_vendorId_idx" ON "ProductVendor"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVendor_productId_vendorId_role_key" ON "ProductVendor"("productId", "vendorId", "role");

-- CreateIndex
CREATE INDEX "StockLog_type_createdAt_idx" ON "StockLog"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "StockLog_productId_createdAt_idx" ON "StockLog"("productId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "StockLog_vendorId_idx" ON "StockLog"("vendorId");

-- CreateIndex
CREATE INDEX "ScheduleEvent_startsAt_idx" ON "ScheduleEvent"("startsAt");

-- CreateIndex
CREATE INDEX "ScheduleEvent_seriesId_startsAt_idx" ON "ScheduleEvent"("seriesId", "startsAt");

-- CreateIndex
CREATE INDEX "ScheduleEventParticipant_userId_idx" ON "ScheduleEventParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEventParticipant_eventId_userId_key" ON "ScheduleEventParticipant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "ScheduleReminderSent_eventId_idx" ON "ScheduleReminderSent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleReminderSent_eventId_userId_kind_key" ON "ScheduleReminderSent"("eventId", "userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceLedgerAccount_code_key" ON "FinanceLedgerAccount"("code");

-- CreateIndex
CREATE INDEX "FinanceFxRate_currencyCode_idx" ON "FinanceFxRate"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceFxRate_currencyCode_validFrom_key" ON "FinanceFxRate"("currencyCode", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceJournalEntry_entryNumber_key" ON "FinanceJournalEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "FinanceJournalEntry_entryDate_idx" ON "FinanceJournalEntry"("entryDate");

-- CreateIndex
CREATE INDEX "FinanceJournalEntry_status_idx" ON "FinanceJournalEntry"("status");

-- CreateIndex
CREATE INDEX "FinanceJournalEntry_reversesEntryId_idx" ON "FinanceJournalEntry"("reversesEntryId");

-- CreateIndex
CREATE INDEX "FinancePeriodLock_year_idx" ON "FinancePeriodLock"("year");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePeriodLock_year_month_key" ON "FinancePeriodLock"("year", "month");

-- CreateIndex
CREATE INDEX "FinanceJournalLine_accountId_idx" ON "FinanceJournalLine"("accountId");

-- CreateIndex
CREATE INDEX "FinanceJournalLine_entryId_idx" ON "FinanceJournalLine"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceJournalLineLink_lineId_key" ON "FinanceJournalLineLink"("lineId");

-- CreateIndex
CREATE INDEX "FinanceJournalLineLink_billId_idx" ON "FinanceJournalLineLink"("billId");

-- CreateIndex
CREATE INDEX "FinanceJournalLineLink_invoiceId_idx" ON "FinanceJournalLineLink"("invoiceId");

-- CreateIndex
CREATE INDEX "FinanceJournalLineLink_mode_idx" ON "FinanceJournalLineLink"("mode");

-- CreateIndex
CREATE INDEX "FinanceJournalLineAttachment_lineId_idx" ON "FinanceJournalLineAttachment"("lineId");

-- CreateIndex
CREATE INDEX "FinanceJournalLineAttachment_hash_idx" ON "FinanceJournalLineAttachment"("hash");

-- CreateIndex
CREATE INDEX "FinanceBankAccount_ledgerAccountId_idx" ON "FinanceBankAccount"("ledgerAccountId");

-- CreateIndex
CREATE INDEX "BankStatementLine_importId_idx" ON "BankStatementLine"("importId");

-- CreateIndex
CREATE INDEX "FinanceApBill_dueDate_idx" ON "FinanceApBill"("dueDate");

-- CreateIndex
CREATE INDEX "FinanceApBill_status_idx" ON "FinanceApBill"("status");

-- CreateIndex
CREATE INDEX "FinanceApPayment_billId_idx" ON "FinanceApPayment"("billId");

-- CreateIndex
CREATE INDEX "FinanceArInvoice_dueDate_idx" ON "FinanceArInvoice"("dueDate");

-- CreateIndex
CREATE INDEX "FinanceArInvoice_status_idx" ON "FinanceArInvoice"("status");

-- CreateIndex
CREATE INDEX "FinanceArPayment_invoiceId_idx" ON "FinanceArPayment"("invoiceId");

-- CreateIndex
CREATE INDEX "FinanceBudgetLine_year_month_idx" ON "FinanceBudgetLine"("year", "month");

-- CreateIndex
CREATE INDEX "FinanceSpendRequest_status_idx" ON "FinanceSpendRequest"("status");

-- CreateIndex
CREATE INDEX "FaceData_userId_idx" ON "FaceData"("userId");

-- CreateIndex
CREATE INDEX "Attendance_userId_idx" ON "Attendance"("userId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE INDEX "Attendance_userId_date_idx" ON "Attendance"("userId", "date");

-- CreateIndex
CREATE INDEX "ProductDiscoveryQuery_createdById_idx" ON "ProductDiscoveryQuery"("createdById");

-- CreateIndex
CREATE INDEX "ProductDiscoveryQuery_status_idx" ON "ProductDiscoveryQuery"("status");

-- CreateIndex
CREATE INDEX "ProductDiscoveryItem_queryId_idx" ON "ProductDiscoveryItem"("queryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDiscoveryItem_queryId_marketplace_externalId_key" ON "ProductDiscoveryItem"("queryId", "marketplace", "externalId");

-- CreateIndex
CREATE INDEX "ReviewIntelSource_createdById_idx" ON "ReviewIntelSource"("createdById");

-- CreateIndex
CREATE INDEX "ReviewIntelSource_status_idx" ON "ReviewIntelSource"("status");

-- CreateIndex
CREATE INDEX "ReviewIntelSource_brandId_idx" ON "ReviewIntelSource"("brandId");

-- CreateIndex
CREATE INDEX "ReviewIntelSource_platformKey_idx" ON "ReviewIntelSource"("platformKey");

-- CreateIndex
CREATE INDEX "ReviewRaw_sourceId_idx" ON "ReviewRaw"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRaw_sourceId_externalId_key" ON "ReviewRaw"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAnalysis_reviewId_key" ON "ReviewAnalysis"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewAnalysis_sentiment_idx" ON "ReviewAnalysis"("sentiment");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewIntelSummary_sourceId_key" ON "ReviewIntelSummary"("sourceId");

-- CreateIndex
CREATE INDEX "ResearchScrapeJob_status_idx" ON "ResearchScrapeJob"("status");

-- CreateIndex
CREATE INDEX "ResearchScrapeJob_entityId_type_idx" ON "ResearchScrapeJob"("entityId", "type");

-- CreateIndex
CREATE INDEX "ResearchScrapeJob_apifyRunId_idx" ON "ResearchScrapeJob"("apifyRunId");

-- CreateIndex
CREATE INDEX "ResearchCompetitor_createdById_idx" ON "ResearchCompetitor"("createdById");

-- CreateIndex
CREATE INDEX "ResearchCompetitor_isActive_idx" ON "ResearchCompetitor"("isActive");

-- CreateIndex
CREATE INDEX "CompetitorSku_competitorId_idx" ON "CompetitorSku"("competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSku_competitorId_externalId_key" ON "CompetitorSku"("competitorId", "externalId");

-- CreateIndex
CREATE INDEX "CompetitorSnapshot_competitorId_capturedAt_idx" ON "CompetitorSnapshot"("competitorId", "capturedAt");

-- CreateIndex
CREATE INDEX "CompetitorSnapshot_skuId_idx" ON "CompetitorSnapshot"("skuId");

-- CreateIndex
CREATE INDEX "CompetitorAlert_competitorId_isRead_idx" ON "CompetitorAlert"("competitorId", "isRead");

-- CreateIndex
CREATE INDEX "CompetitorAlert_createdAt_idx" ON "CompetitorAlert"("createdAt");

-- CreateIndex
CREATE INDEX "CompetitorProductCategory_createdById_idx" ON "CompetitorProductCategory"("createdById");

-- CreateIndex
CREATE INDEX "CompetitorProductCategory_isActive_idx" ON "CompetitorProductCategory"("isActive");

-- CreateIndex
CREATE INDEX "CompetitorProductTrack_categoryId_idx" ON "CompetitorProductTrack"("categoryId");

-- CreateIndex
CREATE INDEX "CompetitorProductTrack_isActive_idx" ON "CompetitorProductTrack"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorProductTrack_categoryId_productUrl_key" ON "CompetitorProductTrack"("categoryId", "productUrl");

-- CreateIndex
CREATE INDEX "CompetitorProductSnapshot_trackId_capturedAt_idx" ON "CompetitorProductSnapshot"("trackId", "capturedAt");

-- CreateIndex
CREATE INDEX "CompetitorProductSnapshot_categoryId_capturedAt_idx" ON "CompetitorProductSnapshot"("categoryId", "capturedAt");

-- CreateIndex
CREATE INDEX "CompetitorProductAlert_categoryId_isRead_idx" ON "CompetitorProductAlert"("categoryId", "isRead");

-- CreateIndex
CREATE INDEX "CompetitorProductAlert_trackId_idx" ON "CompetitorProductAlert"("trackId");

-- CreateIndex
CREATE INDEX "TrendWatchlist_createdById_idx" ON "TrendWatchlist"("createdById");

-- CreateIndex
CREATE INDEX "TrendWatchlist_isActive_idx" ON "TrendWatchlist"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TrendRadarUserSettings_userId_key" ON "TrendRadarUserSettings"("userId");

-- CreateIndex
CREATE INDEX "TrendRadarDigest_status_idx" ON "TrendRadarDigest"("status");

-- CreateIndex
CREATE INDEX "TrendRadarDigest_isGlobal_weekStart_idx" ON "TrendRadarDigest"("isGlobal", "weekStart");

-- CreateIndex
CREATE INDEX "TrendRadarDigest_watchlistId_idx" ON "TrendRadarDigest"("watchlistId");

-- CreateIndex
CREATE INDEX "TrendRadarDigest_digestMode_idx" ON "TrendRadarDigest"("digestMode");

-- CreateIndex
CREATE INDEX "TrendRadarItem_digestId_idx" ON "TrendRadarItem"("digestId");

-- CreateIndex
CREATE INDEX "TrendRadarItem_phase_idx" ON "TrendRadarItem"("phase");

-- CreateIndex
CREATE INDEX "TrendBpomSnapshot_seed_capturedAt_idx" ON "TrendBpomSnapshot"("seed", "capturedAt");

-- CreateIndex
CREATE INDEX "KeywordIntelQuery_createdById_idx" ON "KeywordIntelQuery"("createdById");

-- CreateIndex
CREATE INDEX "KeywordIntelQuery_status_idx" ON "KeywordIntelQuery"("status");

-- CreateIndex
CREATE INDEX "KeywordIntelQuery_digestMode_idx" ON "KeywordIntelQuery"("digestMode");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordIntelResult_queryId_key" ON "KeywordIntelResult"("queryId");

-- CreateIndex
CREATE INDEX "SocialListeningMonitor_createdById_idx" ON "SocialListeningMonitor"("createdById");

-- CreateIndex
CREATE INDEX "SocialListeningMonitor_isActive_idx" ON "SocialListeningMonitor"("isActive");

-- CreateIndex
CREATE INDEX "SocialListeningBatch_monitorId_idx" ON "SocialListeningBatch"("monitorId");

-- CreateIndex
CREATE INDEX "SocialListeningBatch_status_idx" ON "SocialListeningBatch"("status");

-- CreateIndex
CREATE INDEX "SocialMention_batchId_idx" ON "SocialMention"("batchId");

-- CreateIndex
CREATE INDEX "SocialMention_classification_idx" ON "SocialMention"("classification");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMention_batchId_platform_externalId_key" ON "SocialMention"("batchId", "platform", "externalId");

-- CreateIndex
CREATE INDEX "SocialComment_batchId_idx" ON "SocialComment"("batchId");

-- CreateIndex
CREATE INDEX "SocialComment_mentionId_idx" ON "SocialComment"("mentionId");

-- CreateIndex
CREATE INDEX "SocialComment_classification_idx" ON "SocialComment"("classification");

-- CreateIndex
CREATE UNIQUE INDEX "SocialComment_batchId_platform_externalId_key" ON "SocialComment"("batchId", "platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialListeningSummary_batchId_key" ON "SocialListeningSummary"("batchId");

-- CreateIndex
CREATE INDEX "UspGapAnalysis_createdById_idx" ON "UspGapAnalysis"("createdById");

-- CreateIndex
CREATE INDEX "UspGapAnalysis_status_idx" ON "UspGapAnalysis"("status");

-- CreateIndex
CREATE INDEX "UspGapAnalysis_brandId_idx" ON "UspGapAnalysis"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "UspGapResult_analysisId_key" ON "UspGapResult"("analysisId");

-- CreateIndex
CREATE INDEX "ProductConcept_createdById_idx" ON "ProductConcept"("createdById");

-- CreateIndex
CREATE INDEX "ProductConcept_status_idx" ON "ProductConcept"("status");

-- CreateIndex
CREATE INDEX "ProductConcept_brandId_idx" ON "ProductConcept"("brandId");

-- CreateIndex
CREATE INDEX "ProductConcept_uspGapAnalysisId_idx" ON "ProductConcept"("uspGapAnalysisId");

-- CreateIndex
CREATE INDEX "ProductInnovation_createdById_idx" ON "ProductInnovation"("createdById");

-- CreateIndex
CREATE INDEX "ProductInnovation_status_idx" ON "ProductInnovation"("status");

-- CreateIndex
CREATE INDEX "ProductInnovation_brandId_idx" ON "ProductInnovation"("brandId");

-- CreateIndex
CREATE INDEX "ResearchReport_createdById_idx" ON "ResearchReport"("createdById");

-- CreateIndex
CREATE INDEX "ResearchReport_type_idx" ON "ResearchReport"("type");

-- CreateIndex
CREATE INDEX "ResearchReport_status_idx" ON "ResearchReport"("status");

-- CreateIndex
CREATE INDEX "ResearchReport_createdAt_idx" ON "ResearchReport"("createdAt");

-- CreateIndex
CREATE INDEX "ResearchReportRevision_reportId_idx" ON "ResearchReportRevision"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchReportRevision_reportId_version_key" ON "ResearchReportRevision"("reportId", "version");

-- CreateIndex
CREATE INDEX "ResearchCronRun_mode_startedAt_idx" ON "ResearchCronRun"("mode", "startedAt");

-- CreateIndex
CREATE INDEX "AiOutputFeedback_module_createdAt_idx" ON "AiOutputFeedback"("module", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiOutputFeedback_artifactType_artifactId_createdById_key" ON "AiOutputFeedback"("artifactType", "artifactId", "createdById");

-- CreateIndex
CREATE INDEX "ResearchRecommendation_status_createdAt_idx" ON "ResearchRecommendation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchRecommendation_module_sourceId_idx" ON "ResearchRecommendation"("module", "sourceId");

-- CreateIndex
CREATE INDEX "ResearchRecommendation_owner_idx" ON "ResearchRecommendation"("owner");

-- CreateIndex
CREATE INDEX "BrandCompetitor_createdById_idx" ON "BrandCompetitor"("createdById");

-- CreateIndex
CREATE INDEX "BrandCompetitor_isActive_idx" ON "BrandCompetitor"("isActive");

-- CreateIndex
CREATE INDEX "BrandCompetitor_ownerBrandId_idx" ON "BrandCompetitor"("ownerBrandId");

-- CreateIndex
CREATE INDEX "BrandCompetitorSku_competitorId_idx" ON "BrandCompetitorSku"("competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandCompetitorSku_competitorId_externalId_key" ON "BrandCompetitorSku"("competitorId", "externalId");

-- CreateIndex
CREATE INDEX "BrandCompetitorSnapshot_competitorId_capturedAt_idx" ON "BrandCompetitorSnapshot"("competitorId", "capturedAt");

-- CreateIndex
CREATE INDEX "BrandCompetitorSnapshot_skuId_idx" ON "BrandCompetitorSnapshot"("skuId");

-- CreateIndex
CREATE INDEX "BrandCompetitorAlert_competitorId_isRead_idx" ON "BrandCompetitorAlert"("competitorId", "isRead");

-- CreateIndex
CREATE INDEX "BrandCompetitorAlert_createdAt_idx" ON "BrandCompetitorAlert"("createdAt");

-- CreateIndex
CREATE INDEX "BrandReviewSource_createdById_idx" ON "BrandReviewSource"("createdById");

-- CreateIndex
CREATE INDEX "BrandReviewSource_status_idx" ON "BrandReviewSource"("status");

-- CreateIndex
CREATE INDEX "BrandReviewSource_ownerBrandId_idx" ON "BrandReviewSource"("ownerBrandId");

-- CreateIndex
CREATE INDEX "BrandReviewSource_platformKey_idx" ON "BrandReviewSource"("platformKey");

-- CreateIndex
CREATE INDEX "BrandReviewItem_sourceId_idx" ON "BrandReviewItem"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandReviewItem_sourceId_externalId_key" ON "BrandReviewItem"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandReviewAnalysis_reviewId_key" ON "BrandReviewAnalysis"("reviewId");

-- CreateIndex
CREATE INDEX "BrandReviewAnalysis_sentiment_idx" ON "BrandReviewAnalysis"("sentiment");

-- CreateIndex
CREATE UNIQUE INDEX "BrandReviewSummary_sourceId_key" ON "BrandReviewSummary"("sourceId");

-- CreateIndex
CREATE INDEX "BrandTrendDigest_status_idx" ON "BrandTrendDigest"("status");

-- CreateIndex
CREATE INDEX "BrandTrendDigest_isGlobal_weekStart_idx" ON "BrandTrendDigest"("isGlobal", "weekStart");

-- CreateIndex
CREATE INDEX "BrandTrendDigest_ownerBrandId_idx" ON "BrandTrendDigest"("ownerBrandId");

-- CreateIndex
CREATE INDEX "BrandTrendDigest_digestMode_idx" ON "BrandTrendDigest"("digestMode");

-- CreateIndex
CREATE INDEX "BrandTrendSignal_digestId_idx" ON "BrandTrendSignal"("digestId");

-- CreateIndex
CREATE INDEX "BrandTrendSignal_phase_idx" ON "BrandTrendSignal"("phase");

-- CreateIndex
CREATE INDEX "BrandKeywordQuery_createdById_idx" ON "BrandKeywordQuery"("createdById");

-- CreateIndex
CREATE INDEX "BrandKeywordQuery_status_idx" ON "BrandKeywordQuery"("status");

-- CreateIndex
CREATE INDEX "BrandKeywordQuery_ownerBrandId_idx" ON "BrandKeywordQuery"("ownerBrandId");

-- CreateIndex
CREATE INDEX "BrandKeywordQuery_digestMode_idx" ON "BrandKeywordQuery"("digestMode");

-- CreateIndex
CREATE UNIQUE INDEX "BrandKeywordResult_queryId_key" ON "BrandKeywordResult"("queryId");

-- CreateIndex
CREATE INDEX "BrandSocialMonitor_createdById_idx" ON "BrandSocialMonitor"("createdById");

-- CreateIndex
CREATE INDEX "BrandSocialMonitor_isActive_idx" ON "BrandSocialMonitor"("isActive");

-- CreateIndex
CREATE INDEX "BrandSocialMonitor_ownerBrandId_idx" ON "BrandSocialMonitor"("ownerBrandId");

-- CreateIndex
CREATE INDEX "BrandSocialBatch_monitorId_idx" ON "BrandSocialBatch"("monitorId");

-- CreateIndex
CREATE INDEX "BrandSocialBatch_status_idx" ON "BrandSocialBatch"("status");

-- CreateIndex
CREATE INDEX "BrandSocialMention_batchId_idx" ON "BrandSocialMention"("batchId");

-- CreateIndex
CREATE INDEX "BrandSocialMention_classification_idx" ON "BrandSocialMention"("classification");

-- CreateIndex
CREATE UNIQUE INDEX "BrandSocialMention_batchId_platform_externalId_key" ON "BrandSocialMention"("batchId", "platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandSocialSummary_batchId_key" ON "BrandSocialSummary"("batchId");

-- CreateIndex
CREATE INDEX "BrandAdLibraryMonitor_createdById_idx" ON "BrandAdLibraryMonitor"("createdById");

-- CreateIndex
CREATE INDEX "BrandAdLibraryMonitor_ownerBrandId_idx" ON "BrandAdLibraryMonitor"("ownerBrandId");

-- CreateIndex
CREATE INDEX "BrandAdLibraryMonitor_isActive_idx" ON "BrandAdLibraryMonitor"("isActive");

-- CreateIndex
CREATE INDEX "BrandAdLibraryBatch_monitorId_idx" ON "BrandAdLibraryBatch"("monitorId");

-- CreateIndex
CREATE INDEX "BrandAdLibraryBatch_status_idx" ON "BrandAdLibraryBatch"("status");

-- CreateIndex
CREATE INDEX "BrandAdLibraryAd_monitorId_idx" ON "BrandAdLibraryAd"("monitorId");

-- CreateIndex
CREATE INDEX "BrandAdLibraryAd_batchId_idx" ON "BrandAdLibraryAd"("batchId");

-- CreateIndex
CREATE INDEX "BrandAdLibraryAd_mediaType_idx" ON "BrandAdLibraryAd"("mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "BrandAdLibraryAd_monitorId_externalId_key" ON "BrandAdLibraryAd"("monitorId", "externalId");

-- CreateIndex
CREATE INDEX "BrandUspAnalysis_createdById_idx" ON "BrandUspAnalysis"("createdById");

-- CreateIndex
CREATE INDEX "BrandUspAnalysis_status_idx" ON "BrandUspAnalysis"("status");

-- CreateIndex
CREATE INDEX "BrandUspAnalysis_ownerBrandId_idx" ON "BrandUspAnalysis"("ownerBrandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandUspResult_analysisId_key" ON "BrandUspResult"("analysisId");

-- CreateIndex
CREATE INDEX "BrandResearchScrapeJob_status_idx" ON "BrandResearchScrapeJob"("status");

-- CreateIndex
CREATE INDEX "BrandResearchScrapeJob_entityId_type_idx" ON "BrandResearchScrapeJob"("entityId", "type");

-- CreateIndex
CREATE INDEX "BrandResearchScrapeJob_apifyRunId_idx" ON "BrandResearchScrapeJob"("apifyRunId");

-- CreateIndex
CREATE INDEX "BrandVisualCollection_createdById_idx" ON "BrandVisualCollection"("createdById");

-- CreateIndex
CREATE INDEX "BrandVisualCollection_ownerBrandId_idx" ON "BrandVisualCollection"("ownerBrandId");

-- CreateIndex
CREATE INDEX "BrandVisualCollection_status_idx" ON "BrandVisualCollection"("status");

-- CreateIndex
CREATE INDEX "BrandVisualAsset_collectionId_idx" ON "BrandVisualAsset"("collectionId");

-- CreateIndex
CREATE INDEX "BrandVisualAsset_ownerBrandId_idx" ON "BrandVisualAsset"("ownerBrandId");

-- CreateIndex
CREATE INDEX "BrandVisualAsset_source_idx" ON "BrandVisualAsset"("source");

-- CreateIndex
CREATE UNIQUE INDEX "BrandVisualAsset_collectionId_source_externalId_key" ON "BrandVisualAsset"("collectionId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandPortfolio_brandId_key" ON "BrandPortfolio"("brandId");

-- CreateIndex
CREATE INDEX "BrandPortfolio_createdById_idx" ON "BrandPortfolio"("createdById");

-- CreateIndex
CREATE INDEX "BrandPortfolioLine_portfolioId_idx" ON "BrandPortfolioLine"("portfolioId");

-- CreateIndex
CREATE INDEX "BrandPortfolioLine_productDiscoveryQueryId_idx" ON "BrandPortfolioLine"("productDiscoveryQueryId");

-- CreateIndex
CREATE INDEX "BrandStrategyDocument_createdById_idx" ON "BrandStrategyDocument"("createdById");

-- CreateIndex
CREATE INDEX "BrandStrategyDocument_ownerBrandId_idx" ON "BrandStrategyDocument"("ownerBrandId");

-- CreateIndex
CREATE INDEX "BrandStrategyDocument_status_idx" ON "BrandStrategyDocument"("status");

-- CreateIndex
CREATE INDEX "BrandAudienceProfile_createdById_idx" ON "BrandAudienceProfile"("createdById");

-- CreateIndex
CREATE INDEX "BrandAudienceProfile_ownerBrandId_idx" ON "BrandAudienceProfile"("ownerBrandId");

-- CreateIndex
CREATE INDEX "BrandAudienceProfile_status_idx" ON "BrandAudienceProfile"("status");

-- CreateIndex
CREATE INDEX "BrandCreativeGuideline_createdById_idx" ON "BrandCreativeGuideline"("createdById");

-- CreateIndex
CREATE INDEX "BrandCreativeGuideline_ownerBrandId_idx" ON "BrandCreativeGuideline"("ownerBrandId");

-- CreateIndex
CREATE INDEX "BrandCreativeGuideline_strategyDocumentId_idx" ON "BrandCreativeGuideline"("strategyDocumentId");

-- CreateIndex
CREATE INDEX "BrandCreativeGuideline_status_idx" ON "BrandCreativeGuideline"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DataForSeoCache_cacheKey_key" ON "DataForSeoCache"("cacheKey");

-- CreateIndex
CREATE INDEX "DataForSeoCache_expiresAt_idx" ON "DataForSeoCache"("expiresAt");

-- CreateIndex
CREATE INDEX "SeoJob_status_idx" ON "SeoJob"("status");

-- CreateIndex
CREATE INDEX "SeoJob_entityId_type_idx" ON "SeoJob"("entityId", "type");

-- CreateIndex
CREATE INDEX "SeoJob_dataforseoTaskId_idx" ON "SeoJob"("dataforseoTaskId");

-- CreateIndex
CREATE INDEX "SeoKeywordProject_createdById_idx" ON "SeoKeywordProject"("createdById");

-- CreateIndex
CREATE INDEX "SeoKeywordProject_status_idx" ON "SeoKeywordProject"("status");

-- CreateIndex
CREATE INDEX "SeoKeyword_projectId_clusterLabel_idx" ON "SeoKeyword"("projectId", "clusterLabel");

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeyword_projectId_keyword_key" ON "SeoKeyword"("projectId", "keyword");

-- CreateIndex
CREATE INDEX "SeoRankProject_createdById_idx" ON "SeoRankProject"("createdById");

-- CreateIndex
CREATE INDEX "SeoRankProject_isActive_idx" ON "SeoRankProject"("isActive");

-- CreateIndex
CREATE INDEX "SeoTrackedKeyword_projectId_idx" ON "SeoTrackedKeyword"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoTrackedKeyword_projectId_keyword_key" ON "SeoTrackedKeyword"("projectId", "keyword");

-- CreateIndex
CREATE INDEX "SeoRankSnapshot_trackedKeywordId_capturedAt_idx" ON "SeoRankSnapshot"("trackedKeywordId", "capturedAt");

-- CreateIndex
CREATE INDEX "SeoOnPageAudit_createdById_idx" ON "SeoOnPageAudit"("createdById");

-- CreateIndex
CREATE INDEX "SeoOnPageAudit_status_idx" ON "SeoOnPageAudit"("status");

-- CreateIndex
CREATE INDEX "SeoSiteCrawl_createdById_idx" ON "SeoSiteCrawl"("createdById");

-- CreateIndex
CREATE INDEX "SeoSiteCrawl_status_idx" ON "SeoSiteCrawl"("status");

-- CreateIndex
CREATE INDEX "SeoSiteCrawl_dataforseoTaskId_idx" ON "SeoSiteCrawl"("dataforseoTaskId");

-- CreateIndex
CREATE INDEX "SeoCrawlIssue_crawlId_severity_idx" ON "SeoCrawlIssue"("crawlId", "severity");

-- CreateIndex
CREATE INDEX "SeoBacklinkProfile_createdById_idx" ON "SeoBacklinkProfile"("createdById");

-- CreateIndex
CREATE INDEX "SeoBacklinkProfile_status_idx" ON "SeoBacklinkProfile"("status");

-- CreateIndex
CREATE INDEX "SeoBacklinkSnapshot_profileId_capturedAt_idx" ON "SeoBacklinkSnapshot"("profileId", "capturedAt");

-- CreateIndex
CREATE INDEX "SeoBacklinkGap_profileId_idx" ON "SeoBacklinkGap"("profileId");

-- CreateIndex
CREATE INDEX "SeoContentBrief_createdById_idx" ON "SeoContentBrief"("createdById");

-- CreateIndex
CREATE INDEX "SeoContentBrief_status_idx" ON "SeoContentBrief"("status");

-- CreateIndex
CREATE INDEX "SeoContentDraft_createdById_idx" ON "SeoContentDraft"("createdById");

-- CreateIndex
CREATE INDEX "SeoContentDraft_briefId_idx" ON "SeoContentDraft"("briefId");

-- CreateIndex
CREATE INDEX "SeoMarketplaceAnalysis_createdById_idx" ON "SeoMarketplaceAnalysis"("createdById");

-- CreateIndex
CREATE INDEX "SeoMarketplaceAnalysis_status_idx" ON "SeoMarketplaceAnalysis"("status");

-- CreateIndex
CREATE INDEX "SeoReport_createdById_idx" ON "SeoReport"("createdById");

-- CreateIndex
CREATE INDEX "SeoReport_status_idx" ON "SeoReport"("status");

-- CreateIndex
CREATE INDEX "SeoContentTopicRun_createdById_idx" ON "SeoContentTopicRun"("createdById");

-- CreateIndex
CREATE INDEX "SeoContentTopicRun_status_idx" ON "SeoContentTopicRun"("status");

-- CreateIndex
CREATE INDEX "ContentStudioIdeaSet_createdById_idx" ON "ContentStudioIdeaSet"("createdById");

-- CreateIndex
CREATE INDEX "ContentStudioIdeaSet_ownerBrandId_idx" ON "ContentStudioIdeaSet"("ownerBrandId");

-- CreateIndex
CREATE INDEX "ContentStudioIdeaSet_status_idx" ON "ContentStudioIdeaSet"("status");

-- CreateIndex
CREATE INDEX "ContentStudioIdea_setId_idx" ON "ContentStudioIdea"("setId");

-- CreateIndex
CREATE INDEX "ContentStudioIdea_ownerBrandId_feedback_idx" ON "ContentStudioIdea"("ownerBrandId", "feedback");

-- CreateIndex
CREATE INDEX "ContentStudioIdea_ownerBrandId_used_idx" ON "ContentStudioIdea"("ownerBrandId", "used");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomCustomProcessPhase" ADD CONSTRAINT "RoomCustomProcessPhase_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomView" ADD CONSTRAINT "RoomView_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomCalendarEvent" ADD CONSTRAINT "RoomCalendarEvent_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "RoomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomTimelineMilestone" ADD CONSTRAINT "RoomTimelineMilestone_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "RoomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomWikiPage" ADD CONSTRAINT "RoomWikiPage_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "RoomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomLinkItem" ADD CONSTRAINT "RoomLinkItem_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "RoomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomListColumn" ADD CONSTRAINT "RoomListColumn_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "RoomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomListRow" ADD CONSTRAINT "RoomListRow_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "RoomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomGlossaryEntry" ADD CONSTRAINT "RoomGlossaryEntry_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "RoomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomKanbanColumn" ADD CONSTRAINT "RoomKanbanColumn_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomKanbanColumn" ADD CONSTRAINT "RoomKanbanColumn_customProcessPhaseId_fkey" FOREIGN KEY ("customProcessPhaseId") REFERENCES "RoomCustomProcessPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomContentPlanItem" ADD CONSTRAINT "RoomContentPlanItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomContentPlanItem" ADD CONSTRAINT "RoomContentPlanItem_picUserId_fkey" FOREIGN KEY ("picUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomContentPlanItem" ADD CONSTRAINT "RoomContentPlanItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "RoomChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "RoomMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomChannel" ADD CONSTRAINT "RoomChannel_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomChannelRead" ADD CONSTRAINT "RoomChannelRead_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "RoomChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomChannelRead" ADD CONSTRAINT "RoomChannelRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMessageAttachment" ADD CONSTRAINT "RoomMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "RoomMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversationMember" ADD CONSTRAINT "DirectConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversationMember" ADD CONSTRAINT "DirectConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessageAttachment" ADD CONSTRAINT "DirectMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomDocumentFolder" ADD CONSTRAINT "RoomDocumentFolder_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomDocumentFolder" ADD CONSTRAINT "RoomDocumentFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RoomDocumentFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomDocument" ADD CONSTRAINT "RoomDocument_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomDocument" ADD CONSTRAINT "RoomDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "RoomDocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomDocument" ADD CONSTRAINT "RoomDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomDocumentComment" ADD CONSTRAINT "RoomDocumentComment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RoomDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomDocumentComment" ADD CONSTRAINT "RoomDocumentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomDocumentComment" ADD CONSTRAINT "RoomDocumentComment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_sourceConceptId_fkey" FOREIGN KEY ("sourceConceptId") REFERENCES "ProductConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_customProcessPhaseId_fkey" FOREIGN KEY ("customProcessPhaseId") REFERENCES "RoomCustomProcessPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_kanbanColumnId_fkey" FOREIGN KEY ("kanbanColumnId") REFERENCES "RoomKanbanColumn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contentPlanItemId_fkey" FOREIGN KEY ("contentPlanItemId") REFERENCES "RoomContentPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTagOnTask" ADD CONSTRAINT "TaskTagOnTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTagOnTask" ADD CONSTRAINT "TaskTagOnTask_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TaskTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskKanbanPosition" ADD CONSTRAINT "TaskKanbanPosition_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskKanbanPosition" ADD CONSTRAINT "TaskKanbanPosition_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "RoomKanbanColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachmentComment" ADD CONSTRAINT "TaskAttachmentComment_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "TaskAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachmentComment" ADD CONSTRAINT "TaskAttachmentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachmentComment" ADD CONSTRAINT "TaskAttachmentComment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVendor" ADD CONSTRAINT "ProductVendor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVendor" ADD CONSTRAINT "ProductVendor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLog" ADD CONSTRAINT "StockLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLog" ADD CONSTRAINT "StockLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLog" ADD CONSTRAINT "StockLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEventParticipant" ADD CONSTRAINT "ScheduleEventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ScheduleEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEventParticipant" ADD CONSTRAINT "ScheduleEventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleReminderSent" ADD CONSTRAINT "ScheduleReminderSent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ScheduleEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleReminderSent" ADD CONSTRAINT "ScheduleReminderSent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedgerAccount" ADD CONSTRAINT "FinanceLedgerAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FinanceLedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalEntry" ADD CONSTRAINT "FinanceJournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalEntry" ADD CONSTRAINT "FinanceJournalEntry_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "FinanceJournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePeriodLock" ADD CONSTRAINT "FinancePeriodLock_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLine" ADD CONSTRAINT "FinanceJournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLine" ADD CONSTRAINT "FinanceJournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceLedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLine" ADD CONSTRAINT "FinanceJournalLine_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLineLink" ADD CONSTRAINT "FinanceJournalLineLink_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "FinanceJournalLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLineLink" ADD CONSTRAINT "FinanceJournalLineLink_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLineLink" ADD CONSTRAINT "FinanceJournalLineLink_billId_fkey" FOREIGN KEY ("billId") REFERENCES "FinanceApBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLineLink" ADD CONSTRAINT "FinanceJournalLineLink_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceArInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLineAttachment" ADD CONSTRAINT "FinanceJournalLineAttachment_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "FinanceJournalLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLineAttachment" ADD CONSTRAINT "FinanceJournalLineAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankAccount" ADD CONSTRAINT "FinanceBankAccount_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "FinanceLedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "FinanceBankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_matchedJournalLineId_fkey" FOREIGN KEY ("matchedJournalLineId") REFERENCES "FinanceJournalLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApBill" ADD CONSTRAINT "FinanceApBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApBill" ADD CONSTRAINT "FinanceApBill_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApPayment" ADD CONSTRAINT "FinanceApPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "FinanceApBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApPayment" ADD CONSTRAINT "FinanceApPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "FinanceJournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApPayment" ADD CONSTRAINT "FinanceApPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceArInvoice" ADD CONSTRAINT "FinanceArInvoice_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceArPayment" ADD CONSTRAINT "FinanceArPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceArInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceArPayment" ADD CONSTRAINT "FinanceArPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "FinanceJournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceArPayment" ADD CONSTRAINT "FinanceArPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudgetLine" ADD CONSTRAINT "FinanceBudgetLine_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudgetLine" ADD CONSTRAINT "FinanceBudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceLedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSpendRequest" ADD CONSTRAINT "FinanceSpendRequest_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "FinanceLedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSpendRequest" ADD CONSTRAINT "FinanceSpendRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSpendRequest" ADD CONSTRAINT "FinanceSpendRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSpendRequest" ADD CONSTRAINT "FinanceSpendRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSpendRequest" ADD CONSTRAINT "FinanceSpendRequest_payoutEntryId_fkey" FOREIGN KEY ("payoutEntryId") REFERENCES "FinanceJournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFixedAsset" ADD CONSTRAINT "FinanceFixedAsset_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "FinanceLedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFixedAsset" ADD CONSTRAINT "FinanceFixedAsset_accumAccountId_fkey" FOREIGN KEY ("accumAccountId") REFERENCES "FinanceLedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFixedAsset" ADD CONSTRAINT "FinanceFixedAsset_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "FinanceLedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceData" ADD CONSTRAINT "FaceData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDiscoveryQuery" ADD CONSTRAINT "ProductDiscoveryQuery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDiscoveryItem" ADD CONSTRAINT "ProductDiscoveryItem_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "ProductDiscoveryQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewIntelSource" ADD CONSTRAINT "ReviewIntelSource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewIntelSource" ADD CONSTRAINT "ReviewIntelSource_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRaw" ADD CONSTRAINT "ReviewRaw_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ReviewIntelSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAnalysis" ADD CONSTRAINT "ReviewAnalysis_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ReviewRaw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewIntelSummary" ADD CONSTRAINT "ReviewIntelSummary_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ReviewIntelSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchCompetitor" ADD CONSTRAINT "ResearchCompetitor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSku" ADD CONSTRAINT "CompetitorSku_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "ResearchCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSnapshot" ADD CONSTRAINT "CompetitorSnapshot_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "ResearchCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSnapshot" ADD CONSTRAINT "CompetitorSnapshot_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "CompetitorSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorAlert" ADD CONSTRAINT "CompetitorAlert_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "ResearchCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorProductCategory" ADD CONSTRAINT "CompetitorProductCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorProductTrack" ADD CONSTRAINT "CompetitorProductTrack_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetitorProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorProductSnapshot" ADD CONSTRAINT "CompetitorProductSnapshot_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetitorProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorProductSnapshot" ADD CONSTRAINT "CompetitorProductSnapshot_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "CompetitorProductTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorProductAlert" ADD CONSTRAINT "CompetitorProductAlert_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetitorProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorProductAlert" ADD CONSTRAINT "CompetitorProductAlert_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "CompetitorProductTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendWatchlist" ADD CONSTRAINT "TrendWatchlist_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendRadarUserSettings" ADD CONSTRAINT "TrendRadarUserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendRadarDigest" ADD CONSTRAINT "TrendRadarDigest_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "TrendWatchlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendRadarItem" ADD CONSTRAINT "TrendRadarItem_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "TrendRadarDigest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordIntelQuery" ADD CONSTRAINT "KeywordIntelQuery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordIntelResult" ADD CONSTRAINT "KeywordIntelResult_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "KeywordIntelQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialListeningMonitor" ADD CONSTRAINT "SocialListeningMonitor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialListeningBatch" ADD CONSTRAINT "SocialListeningBatch_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "SocialListeningMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMention" ADD CONSTRAINT "SocialMention_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SocialListeningBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SocialListeningBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "SocialMention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialListeningSummary" ADD CONSTRAINT "SocialListeningSummary_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SocialListeningBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UspGapAnalysis" ADD CONSTRAINT "UspGapAnalysis_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UspGapAnalysis" ADD CONSTRAINT "UspGapAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UspGapResult" ADD CONSTRAINT "UspGapResult_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "UspGapAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductConcept" ADD CONSTRAINT "ProductConcept_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductConcept" ADD CONSTRAINT "ProductConcept_uspGapAnalysisId_fkey" FOREIGN KEY ("uspGapAnalysisId") REFERENCES "UspGapAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductConcept" ADD CONSTRAINT "ProductConcept_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInnovation" ADD CONSTRAINT "ProductInnovation_baseConceptId_fkey" FOREIGN KEY ("baseConceptId") REFERENCES "ProductConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInnovation" ADD CONSTRAINT "ProductInnovation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInnovation" ADD CONSTRAINT "ProductInnovation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchReportRevision" ADD CONSTRAINT "ResearchReportRevision_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ResearchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiOutputFeedback" ADD CONSTRAINT "AiOutputFeedback_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCompetitor" ADD CONSTRAINT "BrandCompetitor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCompetitor" ADD CONSTRAINT "BrandCompetitor_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCompetitorSku" ADD CONSTRAINT "BrandCompetitorSku_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "BrandCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCompetitorSnapshot" ADD CONSTRAINT "BrandCompetitorSnapshot_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "BrandCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCompetitorSnapshot" ADD CONSTRAINT "BrandCompetitorSnapshot_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "BrandCompetitorSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCompetitorAlert" ADD CONSTRAINT "BrandCompetitorAlert_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "BrandCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReviewSource" ADD CONSTRAINT "BrandReviewSource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReviewSource" ADD CONSTRAINT "BrandReviewSource_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReviewItem" ADD CONSTRAINT "BrandReviewItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BrandReviewSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReviewAnalysis" ADD CONSTRAINT "BrandReviewAnalysis_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "BrandReviewItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReviewSummary" ADD CONSTRAINT "BrandReviewSummary_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BrandReviewSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandTrendDigest" ADD CONSTRAINT "BrandTrendDigest_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandTrendSignal" ADD CONSTRAINT "BrandTrendSignal_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "BrandTrendDigest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandKeywordQuery" ADD CONSTRAINT "BrandKeywordQuery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandKeywordQuery" ADD CONSTRAINT "BrandKeywordQuery_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandKeywordResult" ADD CONSTRAINT "BrandKeywordResult_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "BrandKeywordQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSocialMonitor" ADD CONSTRAINT "BrandSocialMonitor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSocialMonitor" ADD CONSTRAINT "BrandSocialMonitor_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSocialBatch" ADD CONSTRAINT "BrandSocialBatch_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "BrandSocialMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSocialMention" ADD CONSTRAINT "BrandSocialMention_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BrandSocialBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSocialSummary" ADD CONSTRAINT "BrandSocialSummary_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BrandSocialBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAdLibraryMonitor" ADD CONSTRAINT "BrandAdLibraryMonitor_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAdLibraryMonitor" ADD CONSTRAINT "BrandAdLibraryMonitor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAdLibraryBatch" ADD CONSTRAINT "BrandAdLibraryBatch_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "BrandAdLibraryMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAdLibraryAd" ADD CONSTRAINT "BrandAdLibraryAd_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "BrandAdLibraryMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandUspAnalysis" ADD CONSTRAINT "BrandUspAnalysis_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandUspAnalysis" ADD CONSTRAINT "BrandUspAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandUspResult" ADD CONSTRAINT "BrandUspResult_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "BrandUspAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandVisualCollection" ADD CONSTRAINT "BrandVisualCollection_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandVisualCollection" ADD CONSTRAINT "BrandVisualCollection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandVisualAsset" ADD CONSTRAINT "BrandVisualAsset_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "BrandVisualCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandVisualAsset" ADD CONSTRAINT "BrandVisualAsset_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandPortfolio" ADD CONSTRAINT "BrandPortfolio_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandPortfolio" ADD CONSTRAINT "BrandPortfolio_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandPortfolioLine" ADD CONSTRAINT "BrandPortfolioLine_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "BrandPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandPortfolioLine" ADD CONSTRAINT "BrandPortfolioLine_productDiscoveryQueryId_fkey" FOREIGN KEY ("productDiscoveryQueryId") REFERENCES "ProductDiscoveryQuery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandStrategyDocument" ADD CONSTRAINT "BrandStrategyDocument_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandStrategyDocument" ADD CONSTRAINT "BrandStrategyDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAudienceProfile" ADD CONSTRAINT "BrandAudienceProfile_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAudienceProfile" ADD CONSTRAINT "BrandAudienceProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCreativeGuideline" ADD CONSTRAINT "BrandCreativeGuideline_strategyDocumentId_fkey" FOREIGN KEY ("strategyDocumentId") REFERENCES "BrandStrategyDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCreativeGuideline" ADD CONSTRAINT "BrandCreativeGuideline_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCreativeGuideline" ADD CONSTRAINT "BrandCreativeGuideline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeywordProject" ADD CONSTRAINT "SeoKeywordProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeyword" ADD CONSTRAINT "SeoKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SeoKeywordProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoRankProject" ADD CONSTRAINT "SeoRankProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoTrackedKeyword" ADD CONSTRAINT "SeoTrackedKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SeoRankProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoRankSnapshot" ADD CONSTRAINT "SeoRankSnapshot_trackedKeywordId_fkey" FOREIGN KEY ("trackedKeywordId") REFERENCES "SeoTrackedKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoOnPageAudit" ADD CONSTRAINT "SeoOnPageAudit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoSiteCrawl" ADD CONSTRAINT "SeoSiteCrawl_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoCrawlIssue" ADD CONSTRAINT "SeoCrawlIssue_crawlId_fkey" FOREIGN KEY ("crawlId") REFERENCES "SeoSiteCrawl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoBacklinkProfile" ADD CONSTRAINT "SeoBacklinkProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoBacklinkSnapshot" ADD CONSTRAINT "SeoBacklinkSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SeoBacklinkProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoBacklinkGap" ADD CONSTRAINT "SeoBacklinkGap_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SeoBacklinkProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentDraft" ADD CONSTRAINT "SeoContentDraft_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentDraft" ADD CONSTRAINT "SeoContentDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoMarketplaceAnalysis" ADD CONSTRAINT "SeoMarketplaceAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoReport" ADD CONSTRAINT "SeoReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentTopicRun" ADD CONSTRAINT "SeoContentTopicRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentStudioIdeaSet" ADD CONSTRAINT "ContentStudioIdeaSet_ownerBrandId_fkey" FOREIGN KEY ("ownerBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentStudioIdeaSet" ADD CONSTRAINT "ContentStudioIdeaSet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentStudioIdea" ADD CONSTRAINT "ContentStudioIdea_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ContentStudioIdeaSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

