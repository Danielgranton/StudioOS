-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BeatPaymentStatus') THEN
    CREATE TYPE "BeatPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "BeatPurchase"
ADD COLUMN IF NOT EXISTS "paymentStatus" "BeatPaymentStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Beat_producerId_idx" ON "Beat"("producerId");
CREATE INDEX IF NOT EXISTS "Beat_isActive_createdAt_idx" ON "Beat"("isActive", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "BeatPurchase_paymentRef_key" ON "BeatPurchase"("paymentRef");
CREATE INDEX IF NOT EXISTS "BeatPurchase_artistId_idx" ON "BeatPurchase"("artistId");
CREATE INDEX IF NOT EXISTS "BeatPurchase_beatId_idx" ON "BeatPurchase"("beatId");
CREATE INDEX IF NOT EXISTS "BeatPurchase_paymentStatus_idx" ON "BeatPurchase"("paymentStatus");
CREATE INDEX IF NOT EXISTS "BeatLike_beatId_idx" ON "BeatLike"("beatId");
CREATE UNIQUE INDEX IF NOT EXISTS "BeatLike_userId_beatId_key" ON "BeatLike"("userId", "beatId");
CREATE INDEX IF NOT EXISTS "BeatPlay_beatId_idx" ON "BeatPlay"("beatId");
CREATE INDEX IF NOT EXISTS "BeatPlay_userId_idx" ON "BeatPlay"("userId");
