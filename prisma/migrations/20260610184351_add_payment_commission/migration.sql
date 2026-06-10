-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "commission_amount" DECIMAL(10,2),
ADD COLUMN     "net_amount" DECIMAL(10,2);
