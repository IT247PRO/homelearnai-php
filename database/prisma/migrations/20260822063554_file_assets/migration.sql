-- CreateTable
CREATE TABLE "FileAsset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerUserId" INTEGER NOT NULL,
    "topicId" INTEGER,
    "kind" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedFilename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "url" TEXT,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FileAsset_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FileAsset_topicId_idx" ON "FileAsset"("topicId");

-- CreateIndex
CREATE INDEX "FileAsset_ownerUserId_idx" ON "FileAsset"("ownerUserId");
