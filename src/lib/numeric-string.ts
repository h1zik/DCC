/**
 * Normalisasi string angka dari input manusia ke bentuk kanonik yang bisa
 * di-parse `Decimal`/`Number` — murni tanpa dependensi (aman untuk client
 * component maupun server).
 *
 * Menerima format angka umum:
 * - 18000000
 * - 18.000.000
 * - 18,000,000
 * - 18000000.50
 * - 18.000.000,50
 * - -1.234,56 (tanda minus dipertahankan)
 */
export function normalizeNumericString(raw: string): string {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return "0";

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  // Kedua separator ada -> separator terakhir dianggap desimal.
  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastDot > lastComma) {
      // 18,000,000.50
      return s.replace(/,/g, "");
    }
    // 18.000.000,50
    return s.replace(/\./g, "").replace(",", ".");
  }

  // Hanya koma.
  if (hasComma) {
    const commaCount = (s.match(/,/g) ?? []).length;
    if (commaCount > 1) {
      // 18,000,000
      return s.replace(/,/g, "");
    }
    const [left, right = ""] = s.split(",");
    if (right.length === 0) return left;
    // 12,5 / 12,50 -> desimal
    if (right.length <= 2) return `${left}.${right}`;
    // 18,000 -> grouping
    return `${left}${right}`;
  }

  // Hanya titik.
  if (hasDot) {
    const dotCount = (s.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      // 18.000.000
      return s.replace(/\./g, "");
    }
    const [left, right = ""] = s.split(".");
    if (right.length === 0) return left;
    // 12.5 / 12.50 -> desimal
    if (right.length <= 2) return `${left}.${right}`;
    // 18.000 -> grouping
    return `${left}${right}`;
  }

  return s;
}
