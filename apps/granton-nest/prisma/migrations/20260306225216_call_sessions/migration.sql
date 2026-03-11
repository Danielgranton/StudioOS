-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorId_fkey";

-- DropForeignKey
ALTER TABLE "CallSession" DROP CONSTRAINT "CallSession_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "CallSession" DROP CONSTRAINT "CallSession_initiatorId_fkey";

-- DropForeignKey
ALTER TABLE "MessageDelivery" DROP CONSTRAINT "MessageDelivery_messageId_fkey";

-- DropForeignKey
ALTER TABLE "MessageDelivery" DROP CONSTRAINT "MessageDelivery_userId_fkey";

-- DropForeignKey
ALTER TABLE "MessageReport" DROP CONSTRAINT "MessageReport_messageId_fkey";

-- DropForeignKey
ALTER TABLE "MessageReport" DROP CONSTRAINT "MessageReport_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "UserBlock" DROP CONSTRAINT "UserBlock_blockedId_fkey";

-- DropForeignKey
ALTER TABLE "UserBlock" DROP CONSTRAINT "UserBlock_blockerId_fkey";

-- DropIndex
DROP INDEX "Beat_isActive_createdAt_idx";

-- DropIndex
DROP INDEX "Beat_producerId_idx";

-- DropIndex
DROP INDEX "BeatLike_beatId_idx";

-- DropIndex
DROP INDEX "BeatPlay_beatId_idx";

-- DropIndex
DROP INDEX "BeatPlay_userId_idx";

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
