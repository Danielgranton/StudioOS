-- CreateEnum CallType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CallType') THEN
    CREATE TYPE "CallType" AS ENUM ('AUDIO', 'VIDEO');
  END IF;
END $$;

-- CreateEnum CallStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CallStatus') THEN
    CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACTIVE', 'REJECTED', 'MISSED', 'ENDED');
  END IF;
END $$;

-- Extend NotificationType enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INCOMING_CALL';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MISSED_CALL';
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CallSession" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "initiatorId" INTEGER NOT NULL,
  "type" "CallType" NOT NULL,
  "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
  "acceptedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "endedById" INTEGER,
  "endedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "CallSession_conversationId_status_idx" ON "CallSession"("conversationId", "status");
CREATE INDEX IF NOT EXISTS "CallSession_initiatorId_createdAt_idx" ON "CallSession"("initiatorId", "createdAt");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CallSession_conversationId_fkey') THEN
    ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CallSession_initiatorId_fkey') THEN
    ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_initiatorId_fkey"
      FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CallSession_endedById_fkey') THEN
    ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_endedById_fkey"
      FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
