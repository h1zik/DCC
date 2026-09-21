import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireFinance: vi.fn(),
  compose: vi.fn(),
  buildHtml: vi.fn(),
  render: vi.fn(),
  prisma: { brand: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth-helpers", () => ({ requireFinance: mocks.requireFinance }));
vi.mock("@/lib/pdf/render-html-to-pdf", () => ({
  renderHtmlToPdfBuffer: mocks.render,
}));
vi.mock("@/lib/finance-monthly-report/compose", () => ({
  composeMonthlyFinanceReport: mocks.compose,
}));
vi.mock("@/lib/finance-monthly-report/html", () => ({
  buildMonthlyReportHtml: mocks.buildHtml,
}));

import { getFinanceMonthlyReportPdf } from "./finance-monthly-report";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T05:00:00.000Z"));
  mocks.requireFinance.mockResolvedValue({ user: { id: "u1", name: "Rina" } });
  mocks.compose.mockResolvedValue({ stub: true });
  mocks.buildHtml.mockReturnValue("<html></html>");
  mocks.render.mockResolvedValue(Buffer.from("PDF"));
  mocks.prisma.brand.findUnique.mockResolvedValue({
    name: "Aurora Skin & Co.",
  });
});

describe("getFinanceMonthlyReportPdf", () => {
  it("menolak non-Finance sebelum menyentuh data", async () => {
    mocks.requireFinance.mockRejectedValue(
      new Error("Hanya tim Finance yang dapat melakukan aksi ini."),
    );
    await expect(
      getFinanceMonthlyReportPdf({ year: 2026, month: 8 }),
    ).rejects.toThrow("Hanya tim Finance");
    expect(mocks.compose).not.toHaveBeenCalled();
    expect(mocks.render).not.toHaveBeenCalled();
  });

  it("menolak bulan tidak valid & periode yang belum dimulai", async () => {
    await expect(
      getFinanceMonthlyReportPdf({ year: 2026, month: 13 }),
    ).rejects.toThrow();
    await expect(
      getFinanceMonthlyReportPdf({ year: 2026, month: 10 }),
    ).rejects.toThrow("Periode laporan belum dimulai.");
    expect(mocks.compose).not.toHaveBeenCalled();
  });

  it("bulan berjalan diperbolehkan", async () => {
    await expect(
      getFinanceMonthlyReportPdf({ year: 2026, month: 9 }),
    ).resolves.toMatchObject({ fileName: "laporan-keuangan-2026-09.pdf" });
  });

  it("brand tak dikenal ditolak", async () => {
    mocks.prisma.brand.findUnique.mockResolvedValue(null);
    await expect(
      getFinanceMonthlyReportPdf({ year: 2026, month: 8, brandId: "nope" }),
    ).rejects.toThrow("Brand tidak ditemukan.");
    expect(mocks.compose).not.toHaveBeenCalled();
  });

  it("mengembalikan base64 + nama file ber-slug brand", async () => {
    const out = await getFinanceMonthlyReportPdf({
      year: 2026,
      month: 8,
      brandId: "b1",
    });
    expect(out).toEqual({
      base64: Buffer.from("PDF").toString("base64"),
      fileName: "laporan-keuangan-2026-08-aurora-skin-co.pdf",
    });
    expect(mocks.compose).toHaveBeenCalledWith(
      { year: 2026, month: 8, brandId: "b1" },
      { generatedByName: "Rina" },
    );
    expect(mocks.render).toHaveBeenCalledWith("<html></html>");
  });
});
