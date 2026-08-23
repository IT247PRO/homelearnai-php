-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiConversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "childId" INTEGER,
    "topicId" INTEGER,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiConversation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiConversation_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiConversation" ("childId", "createdAt", "id", "kind", "status", "updatedAt", "userId") SELECT "childId", "createdAt", "id", "kind", "status", "updatedAt", "userId" FROM "AiConversation";
DROP TABLE "AiConversation";
ALTER TABLE "new_AiConversation" RENAME TO "AiConversation";
CREATE INDEX "AiConversation_userId_idx" ON "AiConversation"("userId");
CREATE INDEX "AiConversation_childId_idx" ON "AiConversation"("childId");
CREATE INDEX "AiConversation_topicId_idx" ON "AiConversation"("topicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
