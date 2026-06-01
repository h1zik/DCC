import { UserRole } from "@prisma/client";
import { format } from "date-fns";

/** Tanggal hari ini sebagai string "YYYY-MM-DD" (waktu lokal server). */
export function getTodayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Role yang boleh mengelola modul absensi (rekap, dashboard, registrasi).
 * Sesuai keputusan: hanya CEO & Administrator.
 */
export function isAttendanceAdmin(role: UserRole | null | undefined): boolean {
  return role === UserRole.CEO || role === UserRole.ADMINISTRATOR;
}

/** Validasi sebuah nilai adalah AttendanceType yang sah. */
export function isValidAttendanceType(value: unknown): boolean {
  return (
    value === "CHECK_IN" ||
    value === "CHECK_OUT" ||
    value === "SICK" ||
    value === "PERMISSION"
  );
}
