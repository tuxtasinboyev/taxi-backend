/*
  Warnings:

  - A unique constraint covering the columns `[referral_code]` on the table `Driver` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "referral_code" VARCHAR(20),
ADD COLUMN     "referred_by_id" TEXT;

-- AlterTable
ALTER TABLE "DriverRequest" ADD COLUMN     "referral_code" VARCHAR(20);

-- CreateTable
CREATE TABLE "ReferralSettings" (
    "id" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    "duration_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralEarning" (
    "id" TEXT NOT NULL,
    "referrer_driver_id" TEXT NOT NULL,
    "referred_driver_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "commission_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "percent_applied" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralEarning_order_id_key" ON "ReferralEarning"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralEarning_commission_id_key" ON "ReferralEarning"("commission_id");

-- CreateIndex
CREATE INDEX "ReferralEarning_referrer_driver_id_idx" ON "ReferralEarning"("referrer_driver_id");

-- CreateIndex
CREATE INDEX "ReferralEarning_referred_driver_id_idx" ON "ReferralEarning"("referred_driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_referral_code_key" ON "Driver"("referral_code");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEarning" ADD CONSTRAINT "ReferralEarning_referrer_driver_id_fkey" FOREIGN KEY ("referrer_driver_id") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEarning" ADD CONSTRAINT "ReferralEarning_referred_driver_id_fkey" FOREIGN KEY ("referred_driver_id") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEarning" ADD CONSTRAINT "ReferralEarning_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEarning" ADD CONSTRAINT "ReferralEarning_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "DriverCommission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
