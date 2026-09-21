import { describe, expect, it } from "vitest";
import { csvCell, csvDate, toCsv } from "./finance-csv";

describe("csvCell", () => {
  it("mengutip sel berisi koma, kutip, atau baris baru", () => {
    expect(csvCell("PT Maju, Tbk")).toBe('"PT Maju, Tbk"');
    expect(csvCell('Toko "Sinar"')).toBe('"Toko ""Sinar"""');
    expect(csvCell("baris1\nbaris2")).toBe('"baris1\nbaris2"');
  });

  it("menetralkan teks yang bisa dieksekusi sebagai formula", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+62812")).toBe("'+62812");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("nominal negatif TIDAK dianggap formula", () => {
    expect(csvCell("-1250000.50")).toBe("-1250000.50");
    expect(csvCell(-42)).toBe("-42");
  });

  it("null/undefined menjadi sel kosong", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("BOM + CRLF + header", () => {
    expect(toCsv(["Kode", "Nama"], [["1000", "Kas"]])).toBe(
      "﻿Kode,Nama\r\n1000,Kas\r\n",
    );
  });
});

describe("csvDate", () => {
  it("memakai tanggal UTC", () => {
    expect(csvDate(new Date("2026-01-31T00:00:00Z"))).toBe("2026-01-31");
    expect(csvDate(null)).toBe("");
  });
});
