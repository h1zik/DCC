import { UserRole } from "@prisma/client";

const JAKARTA_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Tanggal hari ini sebagai string "YYYY-MM-DD" dalam zona Asia/Jakarta. */
export function getTodayDateString(now = new Date()): string {
  return JAKARTA_DATE.format(now);
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
