-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "taxiCategoryId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "taxiCategoryId" TEXT;

-- AlterTable
ALTER TABLE "PricingRule" ADD COLUMN     "taxiCategoryId" TEXT;

-- CreateTable
CREATE TABLE "TaxiCategory" (
    "id" TEXT NOT NULL,
    "name_uz" VARCHAR(50) NOT NULL,
    "name_ru" VARCHAR(50) NOT NULL,
    "name_en" VARCHAR(50) NOT NULL,
    "icon_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxiCategory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_taxiCategoryId_fkey" FOREIGN KEY ("taxiCategoryId") REFERENCES "TaxiCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_taxiCategoryId_fkey" FOREIGN KEY ("taxiCategoryId") REFERENCES "TaxiCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_taxiCategoryId_fkey" FOREIGN KEY ("taxiCategoryId") REFERENCES "TaxiCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
