-- CreateTable
CREATE TABLE "StudyGuide" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scopeType" TEXT NOT NULL,
    "subjectId" INTEGER,
    "unitId" INTEGER,
    "topicId" INTEGER,
    "lessonId" INTEGER,
    "currentVersionId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyGuide_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyGuide_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyGuide_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyGuide_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyGuide_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "StudyGuideVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyGuideVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studyGuideId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" JSONB NOT NULL,
    "reason" TEXT,
    "generationId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyGuideVersion_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyGuideVersion_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AiGeneration" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiConversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "childId" INTEGER,
    "topicId" INTEGER,
    "lessonId" INTEGER,
    "studyGuideVersionId" INTEGER,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiConversation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiConversation_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiConversation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiConversation_studyGuideVersionId_fkey" FOREIGN KEY ("studyGuideVersionId") REFERENCES "StudyGuideVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AiConversation" ("childId", "createdAt", "id", "kind", "lessonId", "status", "topicId", "updatedAt", "userId") SELECT "childId", "createdAt", "id", "kind", "lessonId", "status", "topicId", "updatedAt", "userId" FROM "AiConversation";
DROP TABLE "AiConversation";
ALTER TABLE "new_AiConversation" RENAME TO "AiConversation";
CREATE INDEX "AiConversation_userId_idx" ON "AiConversation"("userId");
CREATE INDEX "AiConversation_childId_idx" ON "AiConversation"("childId");
CREATE INDEX "AiConversation_topicId_idx" ON "AiConversation"("topicId");
CREATE INDEX "AiConversation_studyGuideVersionId_idx" ON "AiConversation"("studyGuideVersionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StudyGuide_currentVersionId_key" ON "StudyGuide"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGuide_subjectId_key" ON "StudyGuide"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGuide_unitId_key" ON "StudyGuide"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGuide_topicId_key" ON "StudyGuide"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGuide_lessonId_key" ON "StudyGuide"("lessonId");

-- CreateIndex
CREATE INDEX "StudyGuideVersion_studyGuideId_idx" ON "StudyGuideVersion"("studyGuideId");
