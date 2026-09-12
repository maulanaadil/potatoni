
-- CreateTable
CREATE TABLE "AssistantSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "instructions" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantSettings_pkey" PRIMARY KEY ("id")
);
