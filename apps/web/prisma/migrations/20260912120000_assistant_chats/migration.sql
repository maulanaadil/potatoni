
-- CreateEnum
CREATE TYPE "AssistantRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "AssistantChat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" "AssistantRole" NOT NULL,
    "content" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actions" JSONB,
    "replies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantChat_userId_updatedAt_idx" ON "AssistantChat"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AssistantMessage_chatId_createdAt_idx" ON "AssistantMessage"("chatId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssistantChat" ADD CONSTRAINT "AssistantChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "AssistantChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
