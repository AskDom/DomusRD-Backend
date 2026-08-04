-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'DOP');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD';
