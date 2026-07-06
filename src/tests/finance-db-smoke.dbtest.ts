/**
 * FINANCE DB SMOKE TEST — pra-deploy.
 *
 * Jalan terhadap Postgres di DATABASE_URL (lihat vitest.db.config.ts yang
 * memuat .env). Menguji jalur SQL mentah yang TIDAK tersentuh unit test
 * ber-mock: counter nomor jurnal (SUBSTRING ... ::int), posting
 * double-entry atomik, dan lock SELECT ... FOR UPDATE.
 *
 * Self-contained: membuat user + memakai CoA yang ada, lalu membersihkan
 * semua data yang dibuatnya. Jalankan dengan `npm run test:db`.
 * JANGAN arahkan DATABASE_URL ke database produksi.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, UserRole } from "@prisma/client";
import {
  createPostedEntryInTx,
  lockApBillForUpdate,
  lockArInvoiceForUpdate,
} from "@/lib/finance-journal-post";

const REF = "DB-SMOKE-TEST";
const TEST_EMAIL = "finance.dbsmoke@test.local";
const prisma = new PrismaClient();

let userId: string;
let accountA: string;
let accountB: string;

beforeAll(async () => {
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    create: {
      email: TEST_EMAIL,
      name: "Finance DB Smoke",
      role: UserRole.FINANCE,
      // Hash bcrypt tidak valid — akun ini tidak pernah bisa dipakai login.
      passwordHash: "!disabled-db-smoke-account",
    },
    update: {},
    select: { id: true },
  });
  userId = user.id;

  const accounts = await prisma.financeLedgerAccount.findMany({
    take: 2,
    select: { id: true },
    orderBy: { code: "asc" },
  });
  if (accounts.length < 2) {
    throw new Error(
      "CoA kosong — buka /finance sekali agar CoA ter-bootstrap, lalu ulangi.",
    );
  }
  accountA = accounts[0]!.id;
  accountB = accounts[1]!.id;
});

afterAll(async () => {
  await prisma.financeJournalLine.deleteMany({
    where: { entry: { reference: REF } },
  });
  await prisma.financeJournalEntry.deleteMany({ where: { reference: REF } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

function balancedInput() {
  return {
    entryDate: new Date(),
    reference: REF,
    memo: "db smoke test — dihapus otomatis",
    createdById: userId,
    lines: [
      { accountId: accountA, debit: "125000.55", credit: "0" },
      { accountId: accountB, debit: "0", credit: "125000.55" },
    ],
  };
}

describe("DB smoke: posting jurnal terhadap Postgres nyata", () => {
  it("membuat entry POSTED bernomor JE-YYYY-NNNNNN via counter Postgres", async () => {
    const id = await prisma.$transaction((tx) =>
      createPostedEntryInTx(tx, balancedInput()),
    );
    const entry = await prisma.financeJournalEntry.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });
    expect(entry.status).toBe("POSTED");
    expect(entry.entryNumber).toMatch(/^JE-\d{4}-\d{6}$/);
    expect(entry.lines).toHaveLength(2);
    const debit = entry.lines.reduce((s, l) => s + Number(l.debitBase), 0);
    const credit = entry.lines.reduce((s, l) => s + Number(l.creditBase), 0);
    expect(debit).toBeCloseTo(credit, 2);
  });

  it("nomor jurnal berurutan antar posting", async () => {
    const id1 = await prisma.$transaction((tx) =>
      createPostedEntryInTx(tx, balancedInput()),
    );
    const id2 = await prisma.$transaction((tx) =>
      createPostedEntryInTx(tx, balancedInput()),
    );
    const [e1, e2] = await Promise.all([
      prisma.financeJournalEntry.findUniqueOrThrow({ where: { id: id1 } }),
      prisma.financeJournalEntry.findUniqueOrThrow({ where: { id: id2 } }),
    ]);
    const seq = (n: string | null) => Number((n ?? "").slice(-6));
    expect(seq(e2.entryNumber)).toBe(seq(e1.entryNumber) + 1);
  });

  it("jurnal tidak seimbang di-rollback total", async () => {
    const before = await prisma.financeJournalEntry.count({
      where: { reference: REF },
    });
    await expect(
      prisma.$transaction((tx) =>
        createPostedEntryInTx(tx, {
          ...balancedInput(),
          lines: [
            { accountId: accountA, debit: "100", credit: "0" },
            { accountId: accountB, debit: "0", credit: "99" },
          ],
        }),
      ),
    ).rejects.toThrow(/tidak seimbang/i);
    const after = await prisma.financeJournalEntry.count({
      where: { reference: REF },
    });
    expect(after).toBe(before);
  });

  it("SQL lock FOR UPDATE valid di Postgres (AP bill & AR invoice)", async () => {
    await prisma.$transaction(async (tx) => {
      await lockApBillForUpdate(tx, "id-tidak-ada");
      await lockArInvoiceForUpdate(tx, "id-tidak-ada");
    });
  });
});
