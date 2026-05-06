import { listFinanceAccounts } from "@/actions/finance-accounts";
import { queryGeneralLedger } from "@/actions/finance-ledger";
import { GeneralLedgerClient } from "./general-ledger-client";

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const from = sp.from ? new Date(sp.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = sp.to ? new Date(sp.to) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const selectedAccountId =
    sp.accountId && sp.accountId !== "__all__" ? sp.accountId : null;

  const [accounts, gl] = await Promise.all([
    listFinanceAccounts(),
    queryGeneralLedger({
      from,
      to,
      accountId: selectedAccountId ?? undefined,
    }),
  ]);

  const openingForSelected =
    selectedAccountId && gl.openingByAccount.has(selectedAccountId)
      ? gl.openingByAccount.get(selectedAccountId)!.toString()
      : selectedAccountId
        ? "0"
        : null;

  const lines = gl.lines.map((l) => ({
    id: l.id,
    debitBase: l.debitBase.toString(),
    creditBase: l.creditBase.toString(),
    account: {
      code: l.account.code,
      name: l.account.name,
      type: l.account.type,
    },
    entry: {
      entryDate: l.entry.entryDate.toISOString(),
      reference: l.entry.reference,
    },
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Buku besar</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Mutasi terposting per akun. Pilih satu akun untuk saldo berjalan.
        </p>
      </div>
      <GeneralLedgerClient
        accounts={accounts.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
        }))}
        lines={lines}
        openingForSelected={openingForSelected}
        selectedAccountId={selectedAccountId}
        fromIso={from.toISOString()}
        toIso={to.toISOString()}
      />
    </div>
  );
}
