import { describe, expect, it } from "vitest";
import {
  parseBankAmount,
  parseFlexibleBankCsv,
  parseLooseDate,
  splitCsvLine,
} from "./finance-bank-csv";

describe("splitCsvLine", () => {
  it("memakai koma sebagai pemisah default dan membuang kutip", () => {
    expect(splitCsvLine('2026-01-05,"Setoran tunai",1500000')).toEqual([
      "2026-01-05",
      "Setoran tunai",
      "1500000",
    ]);
  });

  it("memakai titik koma bila tidak ada koma", () => {
    expect(splitCsvLine("05/01/2026;Transfer keluar;-250000")).toEqual([
      "05/01/2026",
      "Transfer keluar",
      "-250000",
    ]);
  });
});

describe("parseLooseDate", () => {
  it("menerima ISO dan dd/mm/yyyy", () => {
    expect(parseLooseDate("2026-01-31")).not.toBeNull();
    const d = parseLooseDate("31/01/2026");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(0);
    expect(d?.getDate()).toBe(31);
  });

  it("tahun 2 digit dianggap 20xx", () => {
    expect(parseLooseDate("05/01/26")?.getFullYear()).toBe(2026);
  });

  it("mengembalikan null untuk teks non-tanggal", () => {
    expect(parseLooseDate("keterangan")).toBeNull();
  });
});

describe("parseBankAmount", () => {
  it("format US desimal-titik TIDAK lagi membengkak 100×", () => {
    // Parser lama menghapus semua titik: "1234.56" -> 123456 (bug M-14).
    expect(parseBankAmount("1234.56")?.toFixed(2)).toBe("1234.56");
    expect(parseBankAmount("1,000.50")?.toFixed(2)).toBe("1000.50");
  });

  it("format id-ID tetap benar", () => {
    expect(parseBankAmount("1.234,56")?.toFixed(2)).toBe("1234.56");
    expect(parseBankAmount("18.000.000")?.toFixed(2)).toBe("18000000.00");
  });

  it("tanda minus (uang keluar) dipertahankan", () => {
    expect(parseBankAmount("-250000")?.toFixed(2)).toBe("-250000.00");
    expect(parseBankAmount("-1.234,56")?.toFixed(2)).toBe("-1234.56");
  });

  it("mengembalikan null untuk sel kosong / non-angka / NaN", () => {
    expect(parseBankAmount("")).toBeNull();
    expect(parseBankAmount("   ")).toBeNull();
    expect(parseBankAmount("abc")).toBeNull();
    expect(parseBankAmount("NaN")).toBeNull();
  });
});

describe("parseFlexibleBankCsv", () => {
  it("melewati header, mem-parse baris valid, melewati baris rusak", () => {
    const csv = [
      "Tanggal,Keterangan,Jumlah",
      "2026-01-05,Setoran tunai,1500000",
      "06/01/2026,Bayar vendor,-1.234,56", // 4 kolom karena koma desimal -> kolom c = "-1.234"
      "07/01/2026;Transfer masuk;2.500.000",
      "bukan-tanggal,teks,123",
      "2026-01-08,Biaya admin,",
    ].join("\n");
    const rows = parseFlexibleBankCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0].description).toBe("Setoran tunai");
    expect(rows[0].amount.toFixed(2)).toBe("1500000.00");
    // Baris koma-desimal terpotong kolom: nilai terbaca "-1.234" (3 digit -> ribuan)
    expect(rows[1].amount.toFixed(2)).toBe("-1234.00");
    expect(rows[2].amount.toFixed(2)).toBe("2500000.00");
  });

  it("CSV kosong menghasilkan array kosong", () => {
    expect(parseFlexibleBankCsv("")).toEqual([]);
    expect(parseFlexibleBankCsv("Tanggal,Keterangan,Jumlah")).toEqual([]);
  });
});
