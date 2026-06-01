-- Migration: add attendance module (face recognition)
--
-- Generated via:
--   npx prisma migrate diff \
--     --from-schema-datamodel <main:prisma/schema.prisma> \
--     --to-schema-datamodel prisma/schema.prisma \
--     --script
--
-- This file is 100% ADDITIVE: only CREATE / ADD statements.
-- No DROP, TRUNCATE, or DELETE. Safe to run in production.
--
-- Cara apply (production):
--   1. Backup DB dulu (pg_dump).
--   2. Jalankan SQL ini lewat psql / DB admin tool.
--   3. Verifikasi: \dt "Attendance" "FaceData"  + \dT "AttendanceType"
--   4. Deploy aplikasi (Next.js) — Prisma client sudah tahu skema baru.
--
-- Alternatif (jika tim sudah pakai `prisma db push` workflow):
--   `npm run db:push` — akan no-op karena skema sudah sinkron via SQL ini.
--   ⚠️ JANGAN pakai `prisma db push --accept-data-loss` di production tanpa review.

-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'SICK', 'PERMISSION');

-- CreateTable
CREATE TABLE "FaceData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "descriptor" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AttendanceType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "todoList" TEXT,
    "completedTasks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FaceData_userId_idx" ON "FaceData"("userId");

-- CreateIndex
CREATE INDEX "Attendance_userId_idx" ON "Attendance"("userId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE INDEX "Attendance_userId_date_idx" ON "Attendance"("userId", "date");

-- AddForeignKey
ALTER TABLE "FaceData" ADD CONSTRAINT "FaceData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
