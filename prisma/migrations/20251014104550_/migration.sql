-- CreateTable
CREATE TABLE "DriverLocation" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "order_id" TEXT,
    "lat" DECIMAL(10,8) NOT NULL,
    "lng" DECIMAL(10,8) NOT NULL,
    "accuracy" INTEGER,
    "speed" DECIMAL(5,2),
    "bearing" DECIMAL(6,2),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "DriverLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverLocation_driver_id_idx" ON "DriverLocation"("driver_id");

-- CreateIndex
CREATE INDEX "DriverLocation_order_id_idx" ON "DriverLocation"("order_id");

-- CreateIndex
CREATE INDEX "DriverLocation_timestamp_idx" ON "DriverLocation"("timestamp");

-- AddForeignKey
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
