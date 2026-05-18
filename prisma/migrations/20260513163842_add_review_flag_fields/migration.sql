-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "flag_reason" TEXT,
ADD COLUMN     "is_flagged" BOOLEAN NOT NULL DEFAULT false;
