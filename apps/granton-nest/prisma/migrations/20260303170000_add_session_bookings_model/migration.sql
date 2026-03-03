-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingStatus') THEN
        CREATE TYPE "BookingStatus" AS ENUM (
            'PENDING',
            'APPROVED',
            'RECORDING',
            'MIXING',
            'READY',
            'DELIVERED',
            'CANCELLED'
        );
    END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingPaymentStatus') THEN
        CREATE TYPE "BookingPaymentStatus" AS ENUM ('BOOKED', 'FULLY_PAID');
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "session_bookings" (
    "id" SERIAL NOT NULL,
    "artist_id" INTEGER NOT NULL,
    "producer_id" INTEGER NOT NULL,
    "studio_id" TEXT NOT NULL,
    "project_title" TEXT NOT NULL,
    "booking_ref" TEXT NOT NULL,
    "project_id" INTEGER,
    "payment_ref" TEXT,
    "payment_status" "BookingPaymentStatus" NOT NULL DEFAULT 'BOOKED',
    "session_date" DATE NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "recording_started_at" TIMESTAMP(3),
    "mixing_started_at" TIMESTAMP(3),
    "expected_ready_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "session_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "session_bookings_booking_ref_key" ON "session_bookings"("booking_ref");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "session_bookings_artist_id_idx" ON "session_bookings"("artist_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "session_bookings_producer_id_idx" ON "session_bookings"("producer_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "session_bookings_studio_id_idx" ON "session_bookings"("studio_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "session_bookings_project_id_idx" ON "session_bookings"("project_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'session_bookings_artist_id_fkey'
    ) THEN
        ALTER TABLE "session_bookings"
        ADD CONSTRAINT "session_bookings_artist_id_fkey"
        FOREIGN KEY ("artist_id") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'session_bookings_producer_id_fkey'
    ) THEN
        ALTER TABLE "session_bookings"
        ADD CONSTRAINT "session_bookings_producer_id_fkey"
        FOREIGN KEY ("producer_id") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'session_bookings_studio_id_fkey'
    ) THEN
        ALTER TABLE "session_bookings"
        ADD CONSTRAINT "session_bookings_studio_id_fkey"
        FOREIGN KEY ("studio_id") REFERENCES "Studio"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'session_bookings_project_id_fkey'
    ) THEN
        ALTER TABLE "session_bookings"
        ADD CONSTRAINT "session_bookings_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "Project"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

