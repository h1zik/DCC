export const MAX_ATTENDANCE_DETAIL_ITEMS = 20;
export const MAX_ATTENDANCE_DETAIL_LENGTH = 500;

export type AttendanceDetailResult =
  | { ok: true; items: string[] }
  | { ok: false; error: string };

export function normalizeAttendanceDetails(
  value: unknown,
): AttendanceDetailResult {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Daftar keterangan tidak valid." };
  }
  if (value.length > MAX_ATTENDANCE_DETAIL_ITEMS) {
    return {
      ok: false,
      error: `Maksimal ${MAX_ATTENDANCE_DETAIL_ITEMS} item keterangan.`,
    };
  }

  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return { ok: false, error: "Setiap keterangan harus berupa teks." };
    }
    const trimmed = item.trim();
    if (trimmed.length > MAX_ATTENDANCE_DETAIL_LENGTH) {
      return {
        ok: false,
        error: `Setiap keterangan maksimal ${MAX_ATTENDANCE_DETAIL_LENGTH} karakter.`,
      };
    }
    if (trimmed) items.push(trimmed);
  }

  return { ok: true, items };
}
