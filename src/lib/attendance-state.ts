import type { AttendanceTypeValue } from "@/lib/attendance-constants";

export type AttendanceSessionState =
  | "NOT_STARTED"
  | "CHECKED_IN"
  | "CHECKED_OUT";

type AttendanceEvent = {
  type: AttendanceTypeValue;
  timestamp: Date | string;
};

export interface AttendanceSession<T extends AttendanceEvent> {
  state: AttendanceSessionState;
  checkIn: T | null;
  checkOut: T | null;
}

/** Mengambil sesi masuk/pulang terbaru, terlepas dari urutan input. */
export function getLatestAttendanceSession<T extends AttendanceEvent>(
  records: readonly T[],
): AttendanceSession<T> {
  const inOut = records
    .filter((record) =>
      record.type === "CHECK_IN" || record.type === "CHECK_OUT",
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

  const latest = inOut[0];
  if (!latest) {
    return { state: "NOT_STARTED", checkIn: null, checkOut: null };
  }

  if (latest.type === "CHECK_IN") {
    return { state: "CHECKED_IN", checkIn: latest, checkOut: null };
  }

  return {
    state: "CHECKED_OUT",
    checkIn: inOut.slice(1).find((record) => record.type === "CHECK_IN") ?? null,
    checkOut: latest,
  };
}
