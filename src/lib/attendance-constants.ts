/**
 * Konstanta modul absensi. Nilai `AttendanceType` di sini sengaja string
 * literal (bukan enum Prisma) agar aman dipakai di komponen client tanpa
 * menarik `@prisma/client` ke bundle — nilainya identik dengan enum Prisma
 * `AttendanceType` di schema.
 */

export const ATTENDANCE_TYPES = [
  "CHECK_IN",
  "CHECK_OUT",
  "SICK",
  "PERMISSION",
] as const;
export type AttendanceTypeValue = (typeof ATTENDANCE_TYPES)[number];

/** Jenis yang butuh scan wajah. */
export const FACE_SCAN_TYPES: AttendanceTypeValue[] = ["CHECK_IN", "CHECK_OUT"];
/** Jenis yang cukup input alasan (tanpa scan wajah). */
export const NO_FACE_SCAN_TYPES: AttendanceTypeValue[] = ["SICK", "PERMISSION"];

export const ATTENDANCE_TYPE_LABELS: Record<AttendanceTypeValue, string> = {
  CHECK_IN: "Check In",
  CHECK_OUT: "Check Out",
  SICK: "Sakit",
  PERMISSION: "Izin",
};

/** Ambang jarak euclidean face-api — di bawah ini dianggap cocok. */
export const FACE_MATCH_THRESHOLD = 0.6;
/** Confidence minimum sebelum sebuah frame match diperhitungkan. */
export const MIN_CONFIDENCE = 0.4;
/** Jumlah frame cocok berturut-turut sebelum verifikasi diterima. */
export const CONSENSUS_FRAMES = 2;
/** Lama tampil layar hasil sebelum auto-tutup (detik). */
export const RESULT_DISPLAY_SECONDS = 5;

/** Langkah panduan saat merekam wajah dari kamera. */
export const FACE_CAPTURE_STEPS = [
  { label: "front", instruction: "Lihat lurus ke kamera" },
  { label: "left", instruction: "Miringkan kepala sedikit ke kiri" },
  { label: "right", instruction: "Miringkan kepala sedikit ke kanan" },
  { label: "smile", instruction: "Tersenyum" },
] as const;
