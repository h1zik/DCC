-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYEE', 'FREELANCE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'EMPLOYEE';
