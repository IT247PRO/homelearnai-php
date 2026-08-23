-- AlterTable
ALTER TABLE "CurriculumLessonSection" ADD COLUMN "choices" JSONB;
ALTER TABLE "CurriculumLessonSection" ADD COLUMN "correctAnswer" JSONB;
ALTER TABLE "CurriculumLessonSection" ADD COLUMN "hints" JSONB;
ALTER TABLE "CurriculumLessonSection" ADD COLUMN "interactionType" TEXT;

-- AlterTable
ALTER TABLE "LessonSection" ADD COLUMN "choices" JSONB;
ALTER TABLE "LessonSection" ADD COLUMN "correctAnswer" JSONB;
ALTER TABLE "LessonSection" ADD COLUMN "hints" JSONB;
ALTER TABLE "LessonSection" ADD COLUMN "interactionType" TEXT;

-- CreateTable
CREATE TABLE "LessonSectionResponse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lessonSectionId" INTEGER NOT NULL,
    "childId" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonSectionResponse_lessonSectionId_fkey" FOREIGN KEY ("lessonSectionId") REFERENCES "LessonSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonSectionResponse_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lessonId" INTEGER NOT NULL,
    "childId" INTEGER NOT NULL,
    "currentSectionIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonProgress_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiConversation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiConversation_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiConversation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AiConversation" ("childId", "createdAt", "id", "kind", "status", "topicId", "updatedAt", "userId") SELECT "childId", "createdAt", "id", "kind", "status", "topicId", "updatedAt", "userId" FROM "AiConversation";
DROP TABLE "AiConversation";
ALTER TABLE "new_AiConversation" RENAME TO "AiConversation";
CREATE INDEX "AiConversation_userId_idx" ON "AiConversation"("userId");
CREATE INDEX "AiConversation_childId_idx" ON "AiConversation"("childId");
CREATE INDEX "AiConversation_topicId_idx" ON "AiConversation"("topicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "LessonSectionResponse_lessonSectionId_childId_idx" ON "LessonSectionResponse"("lessonSectionId", "childId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_lessonId_childId_key" ON "LessonProgress"("lessonId", "childId");
