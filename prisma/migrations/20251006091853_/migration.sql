/*
  Warnings:

  - You are about to drop the column `google_id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password_hash` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."User_google_id_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "google_id",
DROP COLUMN "password_hash";
