-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "interests" TEXT NOT NULL DEFAULT '',
    "focusAreas" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeliveryPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'daily',
    "detailLevel" TEXT NOT NULL DEFAULT 'CONCISE',
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertThreshold" REAL NOT NULL DEFAULT 0.82,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConnectorAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "accountKey" TEXT,
    "accessToken" TEXT,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" DATETIME,
    "syncError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConnectorAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TelemetrySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "connectorType" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "dataJson" TEXT NOT NULL,
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelemetrySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "signalsJson" TEXT NOT NULL,
    "topLanguagesJson" TEXT NOT NULL DEFAULT '[]',
    "topFrameworksJson" TEXT NOT NULL DEFAULT '[]',
    "topToolsJson" TEXT NOT NULL DEFAULT '[]',
    "topTopicsJson" TEXT NOT NULL DEFAULT '[]',
    "trackedReposJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackedRepo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "activityScore" REAL NOT NULL DEFAULT 0.5,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrackedRepo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceFeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "url" TEXT,
    "repoFullName" TEXT,
    "description" TEXT NOT NULL,
    "trustScore" REAL NOT NULL DEFAULT 0.9,
    "baseTagsJson" TEXT NOT NULL DEFAULT '[]',
    "cadence" TEXT NOT NULL DEFAULT 'daily',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" DATETIME,
    "lastSyncStatus" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RawIngestRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceFeedId" TEXT NOT NULL,
    "contentItemId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawIngestRecord_sourceFeedId_fkey" FOREIGN KEY ("sourceFeedId") REFERENCES "SourceFeed" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RawIngestRecord_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceFeedId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "contentKind" TEXT NOT NULL,
    "author" TEXT,
    "publishedAt" DATETIME,
    "summary" TEXT,
    "actionableSummary" TEXT,
    "whyItMattersTemplate" TEXT,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "trustScore" REAL NOT NULL DEFAULT 0.8,
    "ecosystemImportance" REAL NOT NULL DEFAULT 0.5,
    "actionability" REAL NOT NULL DEFAULT 0.5,
    "freshness" REAL NOT NULL DEFAULT 0.5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentItem_sourceFeedId_fkey" FOREIGN KEY ("sourceFeedId") REFERENCES "SourceFeed" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 0.5,
    "source" TEXT NOT NULL,
    CONSTRAINT "ItemTag_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "finalScore" REAL NOT NULL,
    "personalRelevance" REAL NOT NULL,
    "ecosystemImportance" REAL NOT NULL,
    "actionability" REAL NOT NULL,
    "freshness" REAL NOT NULL,
    "trustMultiplier" REAL NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "whyShown" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recommendation_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Digest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DIGEST',
    "subject" TEXT NOT NULL,
    "previewText" TEXT NOT NULL,
    "detailLevel" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveryRef" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    CONSTRAINT "Digest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DigestItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "digestId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "DigestItem_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "Digest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DigestItem_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserFeedback_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPreference_userId_key" ON "DeliveryPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorAccount_userId_type_key" ON "ConnectorAccount"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedRepo_userId_fullName_key" ON "TrackedRepo"("userId", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX "SourceFeed_key_key" ON "SourceFeed"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_dedupeKey_key" ON "ContentItem"("dedupeKey");

-- CreateIndex
CREATE INDEX "ContentItem_publishedAt_idx" ON "ContentItem"("publishedAt");

-- CreateIndex
CREATE INDEX "ContentItem_sourceType_idx" ON "ContentItem"("sourceType");

-- CreateIndex
CREATE INDEX "ItemTag_contentItemId_idx" ON "ItemTag"("contentItemId");

-- CreateIndex
CREATE INDEX "ItemTag_label_idx" ON "ItemTag"("label");

-- CreateIndex
CREATE INDEX "Recommendation_section_finalScore_idx" ON "Recommendation"("section", "finalScore");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_userId_contentItemId_key" ON "Recommendation"("userId", "contentItemId");

-- CreateIndex
CREATE INDEX "DigestItem_digestId_idx" ON "DigestItem"("digestId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFeedback_userId_contentItemId_type_key" ON "UserFeedback"("userId", "contentItemId", "type");

