import type { AttendanceTypeValue } from "@/lib/attendance-constants";

/** Bentuk catatan absensi yang sudah di-serialize untuk dikirim ke client. */
export interface AttendanceRow {
  id: string;
  type: AttendanceTypeValue;
  timestamp: string;
  date: string;
  confidence: number;
  reason: string | null;
  todoList: string | null;
  completedTasks: string | null;
}
