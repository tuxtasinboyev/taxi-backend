/*
  Warnings:

  - Made the column `is_active` on table `TaxiCategory` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "paid_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TaxiCategory" ALTER COLUMN "is_active" SET NOT NULL;
