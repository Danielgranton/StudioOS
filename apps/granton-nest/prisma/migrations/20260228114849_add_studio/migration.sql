/*
  Warnings:

  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_artistId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_producerId_fkey";

-- DropTable
DROP TABLE "Project";

-- DropEnum
DROP TYPE "ProjectStatus";

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL,
    "studioName" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "services" TEXT[],
    "pricing" JSONB,
    "availability" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Studio_ownerId_key" ON "Studio"("ownerId");

-- AddForeignKey
ALTER TABLE "Studio" ADD CONSTRAINT "Studio_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
