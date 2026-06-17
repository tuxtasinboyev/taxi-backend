-- CreateEnum
CREATE TYPE "DriverCommissionStatus" AS ENUM ('unpaid', 'pending', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "DriverCommissionPaymentStatus" AS ENUM ('pending', 'success', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "DriverCommission" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_amount" DECIMAL(10,2) NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "commission_amount" DECIMAL(10,2) NOT NULL,
    "work_date" TIMESTAMP(3) NOT NULL,
    "status" "DriverCommissionStatus" NOT NULL DEFAULT 'unpaid',
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverCommissionPayment" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "DriverCommissionPaymentStatus" NOT NULL DEFAULT 'pending',
    "provider" VARCHAR(50) NOT NULL DEFAULT 'click',
    "merchant_trans_id" TEXT NOT NULL,
    "click_trans_id" BIGINT,
    "click_paydoc_id" BIGINT,
    "from_date" TIMESTAMP(3),
    "to_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverCommissionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverCommission_order_id_key" ON "DriverCommission"("order_id");

-- CreateIndex
CREATE INDEX "DriverCommission_driver_id_idx" ON "DriverCommission"("driver_id");

-- CreateIndex
CREATE INDEX "DriverCommission_work_date_idx" ON "DriverCommission"("work_date");

-- CreateIndex
CREATE INDEX "DriverCommission_status_idx" ON "DriverCommission"("status");

-- CreateIndex
CREATE INDEX "DriverCommission_payment_id_idx" ON "DriverCommission"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "DriverCommissionPayment_merchant_trans_id_key" ON "DriverCommissionPayment"("merchant_trans_id");

-- CreateIndex
CREATE INDEX "DriverCommissionPayment_driver_id_idx" ON "DriverCommissionPayment"("driver_id");

-- CreateIndex
CREATE INDEX "DriverCommissionPayment_status_idx" ON "DriverCommissionPayment"("status");

-- CreateIndex
CREATE INDEX "DriverCommissionPayment_merchant_trans_id_idx" ON "DriverCommissionPayment"("merchant_trans_id");

-- AddForeignKey
ALTER TABLE "DriverCommission" ADD CONSTRAINT "DriverCommission_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverCommission" ADD CONSTRAINT "DriverCommission_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverCommission" ADD CONSTRAINT "DriverCommission_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "DriverCommissionPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverCommissionPayment" ADD CONSTRAINT "DriverCommissionPayment_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
