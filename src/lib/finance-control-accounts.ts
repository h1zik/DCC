import "server-only";

import type { FinanceTx } from "@/lib/finance-journal-post";

/**
 * Resolusi akun kontrol AP/AR lewat FLAG (`isApControl`/`isArControl`), bukan
 * lewat kode literal. Dulu jalur tagihan/pembayaran mencari `code: "2000"` /
 * `"1200"` padahal kode akun bisa diubah user di halaman CoA — rename kode
 * langsung mematikan AP/AR.
 *
 * Kompatibel mundur: CoA standar (flag di 2000/1200) menghasilkan akun yang
 * sama persis dengan perilaku lama, dan CoA lama yang flag-nya belum terisi
 * tetap jatuh ke kode bawaan.
 */

export type ControlKind = "AP" | "AR";

const LEGACY_CODE: Record<ControlKind, string> = { AP: "2000", AR: "1200" };
const LABEL: Record<ControlKind, string> = {
  AP: "kontrol hutang usaha (AP control)",
  AR: "kontrol piutang usaha (AR control)",
};

interface Candidate {
  id: string;
  code: string;
}

/** Murni — dipisah agar bisa diunit-test tanpa DB. */
export function pickControlAccount<T extends Candidate>(
  kind: ControlKind,
  flagged: T[],
  legacy: T | null,
): T {
  if (flagged.length === 1) return flagged[0];
  if (flagged.length > 1) {
    const std = flagged.find((a) => a.code === LEGACY_CODE[kind]);
    if (std) return std;
    throw new Error(
      `Ada ${flagged.length} akun ${LABEL[kind]} aktif (${flagged
        .map((a) => a.code)
        .join(", ")}). Sisakan satu di Chart of Accounts.`,
    );
  }
  if (legacy) return legacy;
  throw new Error(
    `Belum ada akun ${LABEL[kind]}. Tandai satu akun di Chart of Accounts.`,
  );
}

export async function resolveControlAccount(tx: FinanceTx, kind: ControlKind) {
  const flagged = await tx.financeLedgerAccount.findMany({
    where: {
      isActive: true,
      ...(kind === "AP" ? { isApControl: true } : { isArControl: true }),
    },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  const legacy =
    flagged.length === 0
      ? await tx.financeLedgerAccount.findUnique({
          where: { code: LEGACY_CODE[kind] },
        })
      : null;
  return pickControlAccount(kind, flagged, legacy);
}

/**
 * Akun kontrol tempat sebuah bill/invoice DIAKUI (baris jurnal ber-link
 * CREATE_*). Pembayaran harus mengurangi akun yang sama; dokumen lama tanpa
 * link jatuh ke akun kontrol aktif.
 */
export async function resolveDocControlAccountId(
  tx: FinanceTx,
  kind: ControlKind,
  docId: string,
): Promise<string> {
  const link = await tx.financeJournalLineLink.findFirst({
    where: kind === "AP" ? { createdBillId: docId } : { createdInvoiceId: docId },
    select: { line: { select: { accountId: true } } },
  });
  if (link) return link.line.accountId;
  return (await resolveControlAccount(tx, kind)).id;
}
