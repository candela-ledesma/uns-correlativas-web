-- CreateTable (if not exists — may have been created via db push)
CREATE TABLE IF NOT EXISTS "AdminConfig" (
    "id" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "genericPrompt" TEXT,
    "version" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminConfig_pkey" PRIMARY KEY ("id")
);

-- AddColumn (if table already exists but column doesn't)
ALTER TABLE "AdminConfig" ADD COLUMN IF NOT EXISTS "genericPrompt" TEXT;
