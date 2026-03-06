-- CreateTable
CREATE TABLE "Beat" (
    "id" TEXT NOT NULL,
    "producerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "genre" TEXT,
    "bpm" INTEGER,
    "musicalKey" TEXT,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "previewAudioUrl" TEXT NOT NULL,
    "fullAudioUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeatLicense" (
    "id" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "includesWav" BOOLEAN NOT NULL DEFAULT false,
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeatLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeatPurchase" (
    "id" TEXT NOT NULL,
    "artistId" INTEGER NOT NULL,
    "beatId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "amountPaid" INTEGER NOT NULL,
    "paymentRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeatPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeatLike" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "beatId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeatLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeatPlay" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "beatId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeatPlay_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Beat" ADD CONSTRAINT "Beat_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatLicense" ADD CONSTRAINT "BeatLicense_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatPurchase" ADD CONSTRAINT "BeatPurchase_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatPurchase" ADD CONSTRAINT "BeatPurchase_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatPurchase" ADD CONSTRAINT "BeatPurchase_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "BeatLicense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatLike" ADD CONSTRAINT "BeatLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatLike" ADD CONSTRAINT "BeatLike_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatPlay" ADD CONSTRAINT "BeatPlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatPlay" ADD CONSTRAINT "BeatPlay_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

