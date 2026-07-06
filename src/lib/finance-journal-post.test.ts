import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createPostedEntryInTx, type FinanceTx } from "./finance-journal-post";

function makeTx(overrides: { lastEntryNumber?: string | null } = {}) {
  const create = vi.fn(async () => ({ id: "je-1" }));
  const findFirst = vi.fn(async () =>
    overrides.lastEntryNumber === undefined || overrides.lastEntryNumber === null
      ? null
      : { entryNumber: overrides.lastEntryNumber },
  );
  const tx = {
    financeJournalEntry: { create, findFirst },
  } as unknown as FinanceTx;
  return { tx, create, findFirst };
}

function input(lines: Array<{ accountId: string; debit: string; credit: string }>) {
  return {
    entryDate: new Date("2026-06-15T00:00:00Z"),
    reference: "TEST",
    memo: "test",
    createdById: "user-1",
    lines,
  };
}

describe("createPostedEntryInTx", () => {
  it("membuat entry POSTED bernomor sekuensial di dalam tx pemanggil", async () => {
    const { tx, create } = makeTx({ lastEntryNumber: "JE-2026-000041" });

    const id = await createPostedEntryInTx(
      tx,
      input([
        { accountId: "a", debit: "100000", credit: "0" },
        { accountId: "b", debit: "0", credit: "100000" },
      ]),
    );

    expect(id).toBe("je-1");
    const data = create.mock.calls[0][0].data;
    expect(data.status).toBe("POSTED");
    expect(data.entryNumber).toBe("JE-2026-000042");
    expect(data.createdById).toBe("user-1");
    expect(data.lines.create).toHaveLength(2);
  });

  it("menolak jurnal tidak seimbang", async () => {
    const { tx, create } = makeTx();
    await expect(
      createPostedEntryInTx(
        tx,
        input([
          { accountId: "a", debit: "100000", credit: "0" },
          { accountId: "b", debit: "0", credit: "90000" },
        ]),
      ),
    ).rejects.toThrow(/tidak seimbang/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("menolak kurang dari dua baris", async () => {
    const { tx } = makeTx();
    await expect(
      createPostedEntryInTx(tx, input([{ accountId: "a", debit: "1", credit: "0" }])),
    ).rejects.toThrow(/dua baris/i);
  });

  it("menolak nominal negatif dan NaN", async () => {
    const { tx } = makeTx();
    await expect(
      createPostedEntryInTx(
        tx,
        input([
          { accountId: "a", debit: "-5", credit: "0" },
          { accountId: "b", debit: "0", credit: "-5" },
        ]),
      ),
    ).rejects.toThrow(/negatif/i);
    await expect(
      createPostedEntryInTx(
        tx,
        input([
          { accountId: "a", debit: "NaN", credit: "0" },
          { accountId: "b", debit: "0", credit: "NaN" },
        ]),
      ),
    ).rejects.toThrow(/tidak valid/i);
  });

  it("menolak baris dengan debit dan kredit sekaligus", async () => {
    const { tx } = makeTx();
    await expect(
      createPostedEntryInTx(
        tx,
        input([
          { accountId: "a", debit: "5", credit: "5" },
          { accountId: "b", debit: "5", credit: "5" },
        ]),
      ),
    ).rejects.toThrow(/tidak boleh debit dan kredit/i);
  });
});
