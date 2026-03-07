-- Precreate communication objects so older FK-tuning migration can replay on shadow DB.
-- This migration is idempotent and safe on existing databases.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationType') THEN
    CREATE TYPE "ConversationType" AS ENUM ('GENERAL_CHAT', 'BOOKING_CHAT', 'PROJECT_CHAT', 'BEAT_INQUIRY', 'SUPPORT_CHAT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageType') THEN
    CREATE TYPE "MessageType" AS ENUM ('TEXT', 'VOICE', 'FILE', 'BEAT_SHARE', 'BOOKING_REQUEST', 'PROJECT_UPDATE', 'PAYMENT_REQUEST');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationActionType') THEN
    CREATE TYPE "ConversationActionType" AS ENUM (
      'BOOKING_REQUEST_SENT',
      'BOOKING_REQUEST_ACCEPTED',
      'BOOKING_REQUEST_DECLINED',
      'PAYMENT_REQUEST_SENT',
      'PAYMENT_REQUEST_PAID',
      'PROJECT_STATUS_CHANGED',
      'BEAT_SHARED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM ('NEW_MESSAGE', 'BEAT_SHARED', 'BOOKING_REQUEST', 'PAYMENT_REQUEST', 'PROJECT_UPDATE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Conversation" (
  "id" TEXT NOT NULL,
  "type" "ConversationType" NOT NULL,
  "projectId" INTEGER,
  "bookingRef" TEXT,
  "beatId" TEXT,
  "artistId" INTEGER,
  "producerId" INTEGER,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" INTEGER NOT NULL,
  "content" TEXT,
  "messageType" "MessageType" NOT NULL DEFAULT 'TEXT',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "editedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileName" TEXT,
  "fileSize" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConversationAction" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "messageId" TEXT,
  "actorId" INTEGER NOT NULL,
  "actionType" "ConversationActionType" NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "type" "NotificationType" NOT NULL,
  "message" TEXT NOT NULL,
  "data" JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConversationParticipant_conversationId_fkey') THEN
    ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConversationParticipant_userId_fkey') THEN
    ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_conversationId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageAttachment_messageId_fkey') THEN
    ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConversationAction_conversationId_fkey') THEN
    ALTER TABLE "ConversationAction" ADD CONSTRAINT "ConversationAction_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
