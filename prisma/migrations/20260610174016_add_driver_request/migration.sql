-- CreateEnum
CREATE TYPE "DriverRequestStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "DriverRequest" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "car_model" VARCHAR(100) NOT NULL,
    "car_number" VARCHAR(20) NOT NULL,
    "license_number" VARCHAR(50) NOT NULL,
    "status" "DriverRequestStatus" NOT NULL DEFAULT 'pending',
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DriverRequest" ADD CONSTRAINT "DriverRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
