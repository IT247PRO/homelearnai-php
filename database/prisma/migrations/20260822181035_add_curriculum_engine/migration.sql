-- CreateTable
CREATE TABLE "Curriculum" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subjectArea" TEXT NOT NULL,
    "gradeLevel" TEXT,
    "schoolYear" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'parent_created',
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "rawText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "masteryThresholdPercent" INTEGER NOT NULL DEFAULT 70,
    "outlineApprovedAt" DATETIME,
    "outlineApprovedByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Curriculum_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumUnit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "curriculumId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "confidence" TEXT NOT NULL DEFAULT 'inferred',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CurriculumUnit_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumTopic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "curriculumUnitId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "confidence" TEXT NOT NULL DEFAULT 'inferred',
    "sourceExcerpt" TEXT,
    "estimatedLessonCount" INTEGER,
    "lessonPlanStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CurriculumTopic_curriculumUnitId_fkey" FOREIGN KEY ("curriculumUnitId") REFERENCES "CurriculumUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumSkill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "curriculumTopicId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CurriculumSkill_curriculumTopicId_fkey" FOREIGN KEY ("curriculumTopicId") REFERENCES "CurriculumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumObjective" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "curriculumTopicId" INTEGER NOT NULL,
    "curriculumSkillId" INTEGER,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CurriculumObjective_curriculumTopicId_fkey" FOREIGN KEY ("curriculumTopicId") REFERENCES "CurriculumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CurriculumObjective_curriculumSkillId_fkey" FOREIGN KEY ("curriculumSkillId") REFERENCES "CurriculumSkill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumPrerequisite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicId" INTEGER NOT NULL,
    "requiresTopicId" INTEGER NOT NULL,
    CONSTRAINT "CurriculumPrerequisite_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "CurriculumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CurriculumPrerequisite_requiresTopicId_fkey" FOREIGN KEY ("requiresTopicId") REFERENCES "CurriculumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumLesson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "curriculumTopicId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL DEFAULT 0,
    "lessonType" TEXT NOT NULL DEFAULT 'instruction',
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 30,
    "generationId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CurriculumLesson_curriculumTopicId_fkey" FOREIGN KEY ("curriculumTopicId") REFERENCES "CurriculumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CurriculumLesson_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AiGeneration" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumLessonSection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "curriculumLessonId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CurriculumLessonSection_curriculumLessonId_fkey" FOREIGN KEY ("curriculumLessonId") REFERENCES "CurriculumLesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumAssessment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "curriculumTopicId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "generationId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CurriculumAssessment_curriculumTopicId_fkey" FOREIGN KEY ("curriculumTopicId") REFERENCES "CurriculumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CurriculumAssessment_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AiGeneration" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "curriculumAssessmentId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" JSONB,
    "correctAnswer" JSONB,
    "difficultyLevel" TEXT NOT NULL DEFAULT 'medium',
    "curriculumSkillId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CurriculumQuestion_curriculumAssessmentId_fkey" FOREIGN KEY ("curriculumAssessmentId") REFERENCES "CurriculumAssessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CurriculumQuestion_curriculumSkillId_fkey" FOREIGN KEY ("curriculumSkillId") REFERENCES "CurriculumSkill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChildCurriculum" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "childId" INTEGER NOT NULL,
    "curriculumId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "adoptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChildCurriculum_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChildCurriculum_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChildCurriculum_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiGeneration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER,
    "userId" INTEGER NOT NULL,
    "childId" INTEGER,
    "curriculumId" INTEGER,
    "kind" TEXT NOT NULL,
    "promptTemplateId" INTEGER,
    "promptTemplateVersion" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "requestContextRedacted" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'pending',
    "validationErrors" JSONB,
    "resultRefTable" TEXT,
    "resultRefId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "correlationId" TEXT,
    "requestId" TEXT,
    "durationMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "costUsd" REAL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiGeneration_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiGeneration_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiGeneration_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiGeneration_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "AiPromptTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AiGeneration" ("childId", "completionTokens", "conversationId", "correlationId", "costUsd", "createdAt", "durationMs", "errorMessage", "id", "kind", "model", "promptTemplateId", "promptTemplateVersion", "promptTokens", "provider", "requestContextRedacted", "requestId", "resultRefId", "resultRefTable", "status", "updatedAt", "userId", "validationErrors", "validationStatus") SELECT "childId", "completionTokens", "conversationId", "correlationId", "costUsd", "createdAt", "durationMs", "errorMessage", "id", "kind", "model", "promptTemplateId", "promptTemplateVersion", "promptTokens", "provider", "requestContextRedacted", "requestId", "resultRefId", "resultRefTable", "status", "updatedAt", "userId", "validationErrors", "validationStatus" FROM "AiGeneration";
DROP TABLE "AiGeneration";
ALTER TABLE "new_AiGeneration" RENAME TO "AiGeneration";
CREATE INDEX "AiGeneration_userId_idx" ON "AiGeneration"("userId");
CREATE INDEX "AiGeneration_childId_idx" ON "AiGeneration"("childId");
CREATE INDEX "AiGeneration_curriculumId_idx" ON "AiGeneration"("curriculumId");
CREATE TABLE "new_Lesson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "estimatedMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL DEFAULT 'parent_authored',
    "generationId" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "curriculumLessonId" INTEGER,
    "lessonType" TEXT,
    "sequenceNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lesson_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lesson_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AiGeneration" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lesson_curriculumLessonId_fkey" FOREIGN KEY ("curriculumLessonId") REFERENCES "CurriculumLesson" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lesson" ("createdAt", "estimatedMinutes", "generationId", "id", "source", "status", "title", "topicId", "updatedAt", "version") SELECT "createdAt", "estimatedMinutes", "generationId", "id", "source", "status", "title", "topicId", "updatedAt", "version" FROM "Lesson";
DROP TABLE "Lesson";
ALTER TABLE "new_Lesson" RENAME TO "Lesson";
CREATE INDEX "Lesson_topicId_idx" ON "Lesson"("topicId");
CREATE INDEX "Lesson_curriculumLessonId_idx" ON "Lesson"("curriculumLessonId");
CREATE TABLE "new_Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assessmentId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" JSONB,
    "correctAnswer" JSONB,
    "difficultyLevel" TEXT NOT NULL DEFAULT 'medium',
    "skillTagTopicId" INTEGER,
    "sourceCurriculumSkillId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Question_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_skillTagTopicId_fkey" FOREIGN KEY ("skillTagTopicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_sourceCurriculumSkillId_fkey" FOREIGN KEY ("sourceCurriculumSkillId") REFERENCES "CurriculumSkill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("assessmentId", "choices", "correctAnswer", "difficultyLevel", "id", "prompt", "skillTagTopicId", "sortOrder", "type") SELECT "assessmentId", "choices", "correctAnswer", "difficultyLevel", "id", "prompt", "skillTagTopicId", "sortOrder", "type" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE INDEX "Question_assessmentId_idx" ON "Question"("assessmentId");
CREATE TABLE "new_Topic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unitId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "learningContent" TEXT,
    "contentAssets" JSONB,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 30,
    "prerequisites" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "curriculumTopicId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Topic_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Topic_curriculumTopicId_fkey" FOREIGN KEY ("curriculumTopicId") REFERENCES "CurriculumTopic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Topic" ("contentAssets", "createdAt", "description", "estimatedMinutes", "id", "learningContent", "prerequisites", "required", "sortOrder", "title", "unitId", "updatedAt") SELECT "contentAssets", "createdAt", "description", "estimatedMinutes", "id", "learningContent", "prerequisites", "required", "sortOrder", "title", "unitId", "updatedAt" FROM "Topic";
DROP TABLE "Topic";
ALTER TABLE "new_Topic" RENAME TO "Topic";
CREATE INDEX "Topic_unitId_idx" ON "Topic"("unitId");
CREATE INDEX "Topic_curriculumTopicId_idx" ON "Topic"("curriculumTopicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Curriculum_userId_idx" ON "Curriculum"("userId");

-- CreateIndex
CREATE INDEX "CurriculumUnit_curriculumId_idx" ON "CurriculumUnit"("curriculumId");

-- CreateIndex
CREATE INDEX "CurriculumTopic_curriculumUnitId_idx" ON "CurriculumTopic"("curriculumUnitId");

-- CreateIndex
CREATE INDEX "CurriculumSkill_curriculumTopicId_idx" ON "CurriculumSkill"("curriculumTopicId");

-- CreateIndex
CREATE INDEX "CurriculumObjective_curriculumTopicId_idx" ON "CurriculumObjective"("curriculumTopicId");

-- CreateIndex
CREATE INDEX "CurriculumObjective_curriculumSkillId_idx" ON "CurriculumObjective"("curriculumSkillId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumPrerequisite_topicId_requiresTopicId_key" ON "CurriculumPrerequisite"("topicId", "requiresTopicId");

-- CreateIndex
CREATE INDEX "CurriculumLesson_curriculumTopicId_idx" ON "CurriculumLesson"("curriculumTopicId");

-- CreateIndex
CREATE INDEX "CurriculumLessonSection_curriculumLessonId_idx" ON "CurriculumLessonSection"("curriculumLessonId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumAssessment_curriculumTopicId_key" ON "CurriculumAssessment"("curriculumTopicId");

-- CreateIndex
CREATE INDEX "CurriculumQuestion_curriculumAssessmentId_idx" ON "CurriculumQuestion"("curriculumAssessmentId");

-- CreateIndex
CREATE INDEX "ChildCurriculum_childId_idx" ON "ChildCurriculum"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildCurriculum_childId_curriculumId_key" ON "ChildCurriculum"("childId", "curriculumId");
