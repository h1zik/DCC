/**
 * Pembentuk CSV untuk ekspor laporan keuangan — murni, tanpa I/O.
 *
 * - Pemisah koma, baris CRLF, BOM UTF-8 agar Excel membaca aksara dengan benar.
 * - Nominal ditulis sebagai desimal polos ("1234567.00") supaya bisa dijumlah
 *   ulang oleh akuntan/auditor tanpa membersihkan format.
 * - Teks yang diawali = + - @ diberi awalan apostrof: memo/nama vendor berasal
 *   dari input user dan bisa dieksekusi sebagai formula saat dibuka di Excel.
 */

export type CsvValue = string | number | null | undefined;

const NUMERIC = /^-?\d+(\.\d+)?$/;
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (!NUMERIC.test(s) && FORMULA_LEAD.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Tanggal kalender UTC `yyyy-mm-dd` (entryDate tersimpan UTC-midnight). */
export function csvDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
