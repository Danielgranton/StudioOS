/*
  Warnings:

  - The values [REVIEW,PAYMENT,RELEASE,STREAMING,ANALYTICS] on the enum `ProjectStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `dueDate` on the `Project` table. All the data in the column will be lost.
  - Added the required column `bookingRef` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dueAt` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studioId` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Made the column `producerId` on table `Project` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProjectStatus_new" AS ENUM ('BOOKED', 'FULLY_PAID', 'RECORDING', 'MIXING', 'MASTERING', 'READY');
ALTER TABLE "public"."Project" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "status" TYPE "ProjectStatus_new" USING ("status"::text::"ProjectStatus_new");
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ProjectFile'
  ) THEN
    ALTER TABLE "ProjectFile"
      ALTER COLUMN "stage" TYPE "ProjectStatus_new"
      USING ("stage"::text::"ProjectStatus_new");
  END IF;
END $$;
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
DROP TYPE "public"."ProjectStatus_old";
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'BOOKED';
COMMIT;

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_producerId_fkey";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "dueDate",
ADD COLUMN     "bookingRef" TEXT NOT NULL,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "dueAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "paymentRef" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "studioId" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'BOOKED',
ALTER COLUMN "progress" SET DEFAULT 20,
ALTER COLUMN "producerId" SET NOT NULL;

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "stage" "ProjectStatus" NOT NULL,
    "software" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
