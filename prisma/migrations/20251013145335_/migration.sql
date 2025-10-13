/*
  Warnings:

  - A unique constraint covering the columns `[name_uz]` on the table `TaxiCategory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name_ru]` on the table `TaxiCategory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name_en]` on the table `TaxiCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TaxiCategory_name_uz_key" ON "TaxiCategory"("name_uz");

-- CreateIndex
CREATE UNIQUE INDEX "TaxiCategory_name_ru_key" ON "TaxiCategory"("name_ru");

-- CreateIndex
CREATE UNIQUE INDEX "TaxiCategory_name_en_key" ON "TaxiCategory"("name_en");
