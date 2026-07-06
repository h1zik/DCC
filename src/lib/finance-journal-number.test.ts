import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Prisma } from "@prisma/client";
import { nextJournalNumber } from "./finance-journal-number";

function makeTx(lastSeq: number) {
  const $executeRaw = vi.fn(async () => 0);
  const $queryRaw = vi.fn(async () => [{ lastSeq }]);
  return {
    tx: { $executeRaw, $queryRaw } as unknown as Prisma.TransactionClient,
    $executeRaw,
    $queryRaw,
  };
}

describe("nextJournalNumber (counter per tahun, M-03)", () => {
  it("memformat nomor dari counter dengan padding 6 digit", async () => {
    const { tx, $executeRaw, $queryRaw } = makeTx(123);
    const n = await nextJournalNumber(tx, new Date("2026-06-15T00:00:00Z"));
    expect(n).toBe("JE-2026-000123");
    // Seed (INSERT ... ON CONFLICT DO NOTHING) selalu dijalankan sebelum UPDATE.
    expect($executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      $queryRaw.mock.invocationCallOrder[0],
    );
  });

  it("meng-cast offset SUBSTRING ke int agar kompatibel dengan Postgres", async () => {
    const { tx, $executeRaw } = makeTx(1);
    await nextJournalNumber(tx, new Date("2026-06-15T00:00:00Z"));

    const call = $executeRaw.mock.calls[0] as unknown as
      | [TemplateStringsArray, ...unknown[]]
      | undefined;
    const sqlShape = Array.from(call?.[0] ?? []).join("${param}");
    expect(sqlShape).toContain('SUBSTRING("entryNumber" FROM ${param}::int)');
  });

  it("di atas 999999 nomor tetap unik & bertambah (tidak lagi bergantung urutan string)", async () => {
    const { tx } = makeTx(1000000);
    expect(await nextJournalNumber(tx, new Date("2026-06-15T00:00:00Z"))).toBe(
      "JE-2026-1000000",
    );
  });

  it("melempar error jelas bila counter tidak mengembalikan baris", async () => {
    const { tx } = makeTx(0);
    (tx.$queryRaw as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await expect(
      nextJournalNumber(tx, new Date("2026-06-15T00:00:00Z")),
    ).rejects.toThrow(/nomor jurnal/i);
  });
});
