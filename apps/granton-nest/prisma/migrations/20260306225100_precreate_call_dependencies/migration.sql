-- Precreate dependencies required by 20260306225216_call_sessions during shadow replay.
-- Idempotent by design.

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStatus') THEN
    CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ModerationStatus') THEN
    CREATE TYPE "ModerationStatus" AS ENUM ('ACTIVE', 'EDITED', 'DELETED', 'FLAGGED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditEventType') THEN
    CREATE TYPE "AuditEventType" AS ENUM (
      'MESSAGE_CREATED',
      'MESSAGE_EDITED',
      'MESSAGE_DELETED',
      'MESSAGE_REPORTED',
      'USER_BLOCKED',
      'USER_UNBLOCKED',
      'CONVERSATION_CREATED',
      'ACTION_CREATED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CallType') THEN
    CREATE TYPE "CallType" AS ENUM ('AUDIO', 'VIDEO');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CallStatus') THEN
    CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACTIVE', 'REJECTED', 'MISSED', 'ENDED');
  END IF;
END $$;

-- Message + participant columns used by newer communication service
ALTER TABLE "ConversationParticipant"
  ADD COLUMN IF NOT EXISTS "lastReadMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastReadAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unreadCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "moderatedById" INTEGER;

-- Tables expected by 20260306225216_call_sessions
CREATE TABLE IF NOT EXISTS "MessageDelivery" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'SENT',
  "deliveredAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageReport" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "reporterId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserBlock" (
  "id" TEXT NOT NULL,
  "blockerId" INTEGER NOT NULL,
  "blockedId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" INTEGER NOT NULL,
  "eventType" "AuditEventType" NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

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

-- Constraints with names expected by later migrations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageDelivery_messageId_fkey') THEN
    ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageDelivery_userId_fkey') THEN
    ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageReport_messageId_fkey') THEN
    ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageReport_reporterId_fkey') THEN
    ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_reporterId_fkey"
      FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBlock_blockerId_fkey') THEN
    ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey"
      FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBlock_blockedId_fkey') THEN
    ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey"
      FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_actorId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

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

-- Indexes used later (safe to create now)
CREATE UNIQUE INDEX IF NOT EXISTS "MessageDelivery_messageId_userId_key" ON "MessageDelivery"("messageId", "userId");
CREATE INDEX IF NOT EXISTS "MessageDelivery_userId_status_idx" ON "MessageDelivery"("userId", "status");
CREATE INDEX IF NOT EXISTS "MessageDelivery_messageId_idx" ON "MessageDelivery"("messageId");

CREATE INDEX IF NOT EXISTS "MessageReport_messageId_createdAt_idx" ON "MessageReport"("messageId", "createdAt");
CREATE INDEX IF NOT EXISTS "MessageReport_reporterId_createdAt_idx" ON "MessageReport"("reporterId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_eventType_createdAt_idx" ON "AuditLog"("eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "CallSession_conversationId_status_idx" ON "CallSession"("conversationId", "status");
CREATE INDEX IF NOT EXISTS "CallSession_initiatorId_createdAt_idx" ON "CallSession"("initiatorId", "createdAt");
