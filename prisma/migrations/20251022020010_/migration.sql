/*
  Warnings:

  - Added the required column `price_per_km` to the `TaxiCategory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TaxiCategory" ADD COLUMN     "price_per_km" DECIMAL(10,2) NOT NULL;
