/*
  Warnings:

  - You are about to drop the column `price_per_km` on the `TaxiCategory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TaxiCategory" DROP COLUMN "price_per_km",
ADD COLUMN     "price" DECIMAL(10,3);
