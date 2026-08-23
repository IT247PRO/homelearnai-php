-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" DATETIME,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dateFormat" TEXT NOT NULL DEFAULT 'Y-m-d',
    "notificationPreferences" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KidsModeSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "pinHash" TEXT,
    "pinSalt" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KidsModeSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FamilyAiSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tutorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "contentGenerationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultModel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FamilyAiSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Child" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "independenceLevel" INTEGER NOT NULL DEFAULT 1,
    "dateOfBirth" DATETIME,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Child_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "childId" INTEGER,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subject_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subjectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetCompletionDate" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Unit_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Topic" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Topic_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicId" INTEGER NOT NULL,
    "cardType" TEXT NOT NULL DEFAULT 'basic',
    "difficultyLevel" TEXT NOT NULL DEFAULT 'medium',
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "hint" TEXT,
    "choices" JSONB,
    "correctChoices" JSONB,
    "clozeText" TEXT,
    "clozeAnswers" JSONB,
    "questionImageUrl" TEXT,
    "answerImageUrl" TEXT,
    "occlusionData" JSONB,
    "tags" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Flashcard_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FlashcardImport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unitId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "importType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalCards" INTEGER NOT NULL DEFAULT 0,
    "importedCards" INTEGER NOT NULL DEFAULT 0,
    "failedCards" INTEGER NOT NULL DEFAULT 0,
    "duplicateCards" INTEGER NOT NULL DEFAULT 0,
    "mediaFiles" INTEGER NOT NULL DEFAULT 0,
    "importOptions" JSONB,
    "importMetadata" JSONB,
    "importResults" JSONB,
    "rollbackData" JSONB,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FlashcardImport_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FlashcardImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "childId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "lessonId" INTEGER,
    "estimatedMinutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'backlog',
    "commitmentType" TEXT NOT NULL DEFAULT 'preferred',
    "scheduledDayOfWeek" INTEGER,
    "scheduledStartTime" TEXT,
    "scheduledEndTime" TEXT,
    "scheduledDate" DATETIME,
    "skippedFromDate" DATETIME,
    "notes" TEXT,
    "evidenceNotes" TEXT,
    "evidencePhotos" JSONB,
    "evidenceVoiceMemo" TEXT,
    "evidenceAttachments" JSONB,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearningSession_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearningSession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearningSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "childId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "flashcardId" INTEGER,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'new',
    "dueDate" DATETIME,
    "lastReviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LearningSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Review_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "childId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotType" TEXT NOT NULL DEFAULT 'micro',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewSlot_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CatchUpSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "originalSessionId" INTEGER NOT NULL,
    "childId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "missedDate" DATETIME NOT NULL,
    "reason" TEXT,
    "reassignedToSessionId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CatchUpSession_originalSessionId_fkey" FOREIGN KEY ("originalSessionId") REFERENCES "LearningSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatchUpSession_reassignedToSessionId_fkey" FOREIGN KEY ("reassignedToSessionId") REFERENCES "LearningSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CatchUpSession_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatchUpSession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeBlock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "childId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isImported" BOOLEAN NOT NULL DEFAULT false,
    "commitmentType" TEXT NOT NULL DEFAULT 'preferred',
    "sourceUid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeBlock_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KidsModeAuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "childId" INTEGER,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KidsModeAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KidsModeAuditLog_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiPromptTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPromptTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "childId" INTEGER,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiConversation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiGeneration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER,
    "userId" INTEGER NOT NULL,
    "childId" INTEGER,
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
    CONSTRAINT "AiGeneration_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "AiPromptTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" REAL NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiRecommendation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "childId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "generationId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "AiRecommendation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiRecommendation_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AiGeneration" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiInsight" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "childId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "topicId" INTEGER,
    "summary" TEXT NOT NULL,
    "evidence" JSONB,
    "confidence" REAL,
    "generationId" INTEGER,
    "isAcknowledgedByParent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiInsight_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiInsight_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiInsight_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AiGeneration" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "childId" INTEGER NOT NULL,
    "learningGoals" JSONB,
    "interests" JSONB,
    "learningPaceLabel" TEXT,
    "preferredSessionLengthMinutes" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearningProfile_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mastery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "childId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'not_started',
    "accuracy" REAL,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "timeSpentMinutes" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" REAL,
    "lastActivityAt" DATETIME,
    "forgettingRiskScore" REAL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mastery_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mastery_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MasteryEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "masteryId" INTEGER NOT NULL,
    "childId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "previousState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "sourceReviewId" INTEGER,
    "sourceAssessmentId" INTEGER,
    "deltaAccuracy" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MasteryEvent_masteryId_fkey" FOREIGN KEY ("masteryId") REFERENCES "Mastery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MasteryEvent_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MasteryEvent_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MasteryEvent_sourceReviewId_fkey" FOREIGN KEY ("sourceReviewId") REFERENCES "Review" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MasteryEvent_sourceAssessmentId_fkey" FOREIGN KEY ("sourceAssessmentId") REFERENCES "AssessmentAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "estimatedMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL DEFAULT 'parent_authored',
    "generationId" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lesson_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lesson_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AiGeneration" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LessonSection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lessonId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    CONSTRAINT "LessonSection_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LessonResource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lessonId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "metadata" JSONB,
    CONSTRAINT "LessonResource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "childId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai_generated',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "generationId" INTEGER,
    "approvedAt" DATETIME,
    "approvedByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyPlan_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyPlan_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AiGeneration" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudyPlan_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyPlanItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studyPlanId" INTEGER NOT NULL,
    "topicId" INTEGER,
    "lessonId" INTEGER,
    "scheduledDate" DATETIME,
    "dayOfWeek" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "materializedSessionId" INTEGER,
    CONSTRAINT "StudyPlanItem_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyPlanItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudyPlanItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudyPlanItem_materializedSessionId_fkey" FOREIGN KEY ("materializedSessionId") REFERENCES "LearningSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicId" INTEGER,
    "unitId" INTEGER,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai_generated',
    "generationId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assessment_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Assessment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Assessment_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AiGeneration" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assessmentId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" JSONB,
    "correctAnswer" JSONB,
    "difficultyLevel" TEXT NOT NULL DEFAULT 'medium',
    "skillTagTopicId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Question_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_skillTagTopicId_fkey" FOREIGN KEY ("skillTagTopicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assessmentId" INTEGER NOT NULL,
    "childId" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "score" REAL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentAttempt_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "attemptId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "response" JSONB,
    "isCorrect" BOOLEAN,
    "misconceptionTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "KidsModeSettings_userId_key" ON "KidsModeSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyAiSettings_userId_key" ON "FamilyAiSettings"("userId");

-- CreateIndex
CREATE INDEX "Child_userId_idx" ON "Child"("userId");

-- CreateIndex
CREATE INDEX "Subject_userId_idx" ON "Subject"("userId");

-- CreateIndex
CREATE INDEX "Subject_childId_idx" ON "Subject"("childId");

-- CreateIndex
CREATE INDEX "Unit_subjectId_idx" ON "Unit"("subjectId");

-- CreateIndex
CREATE INDEX "Topic_unitId_idx" ON "Topic"("unitId");

-- CreateIndex
CREATE INDEX "Flashcard_topicId_idx" ON "Flashcard"("topicId");

-- CreateIndex
CREATE INDEX "Flashcard_isActive_idx" ON "Flashcard"("isActive");

-- CreateIndex
CREATE INDEX "FlashcardImport_userId_idx" ON "FlashcardImport"("userId");

-- CreateIndex
CREATE INDEX "FlashcardImport_unitId_idx" ON "FlashcardImport"("unitId");

-- CreateIndex
CREATE INDEX "LearningSession_childId_idx" ON "LearningSession"("childId");

-- CreateIndex
CREATE INDEX "LearningSession_topicId_idx" ON "LearningSession"("topicId");

-- CreateIndex
CREATE INDEX "LearningSession_status_idx" ON "LearningSession"("status");

-- CreateIndex
CREATE INDEX "Review_childId_dueDate_idx" ON "Review"("childId", "dueDate");

-- CreateIndex
CREATE INDEX "Review_childId_status_idx" ON "Review"("childId", "status");

-- CreateIndex
CREATE INDEX "ReviewSlot_childId_dayOfWeek_idx" ON "ReviewSlot"("childId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "CatchUpSession_childId_status_idx" ON "CatchUpSession"("childId", "status");

-- CreateIndex
CREATE INDEX "TimeBlock_childId_idx" ON "TimeBlock"("childId");

-- CreateIndex
CREATE INDEX "KidsModeAuditLog_userId_createdAt_idx" ON "KidsModeAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "KidsModeAuditLog_action_createdAt_idx" ON "KidsModeAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiPromptTemplate_key_version_key" ON "AiPromptTemplate"("key", "version");

-- CreateIndex
CREATE INDEX "AiConversation_userId_idx" ON "AiConversation"("userId");

-- CreateIndex
CREATE INDEX "AiConversation_childId_idx" ON "AiConversation"("childId");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_idx" ON "AiMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AiGeneration_userId_idx" ON "AiGeneration"("userId");

-- CreateIndex
CREATE INDEX "AiGeneration_childId_idx" ON "AiGeneration"("childId");

-- CreateIndex
CREATE INDEX "AiUsage_userId_date_idx" ON "AiUsage"("userId", "date");

-- CreateIndex
CREATE INDEX "AiRecommendation_childId_idx" ON "AiRecommendation"("childId");

-- CreateIndex
CREATE INDEX "AiInsight_childId_idx" ON "AiInsight"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningProfile_childId_key" ON "LearningProfile"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "Mastery_childId_topicId_key" ON "Mastery"("childId", "topicId");

-- CreateIndex
CREATE INDEX "MasteryEvent_masteryId_idx" ON "MasteryEvent"("masteryId");

-- CreateIndex
CREATE INDEX "Lesson_topicId_idx" ON "Lesson"("topicId");

-- CreateIndex
CREATE INDEX "LessonSection_lessonId_idx" ON "LessonSection"("lessonId");

-- CreateIndex
CREATE INDEX "LessonResource_lessonId_idx" ON "LessonResource"("lessonId");

-- CreateIndex
CREATE INDEX "StudyPlan_childId_idx" ON "StudyPlan"("childId");

-- CreateIndex
CREATE INDEX "StudyPlanItem_studyPlanId_idx" ON "StudyPlanItem"("studyPlanId");

-- CreateIndex
CREATE INDEX "Assessment_topicId_idx" ON "Assessment"("topicId");

-- CreateIndex
CREATE INDEX "Assessment_unitId_idx" ON "Assessment"("unitId");

-- CreateIndex
CREATE INDEX "Question_assessmentId_idx" ON "Question"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_assessmentId_idx" ON "AssessmentAttempt"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_childId_idx" ON "AssessmentAttempt"("childId");

-- CreateIndex
CREATE INDEX "Answer_attemptId_idx" ON "Answer"("attemptId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");
