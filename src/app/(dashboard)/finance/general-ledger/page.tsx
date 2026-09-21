import { BookOpen } from "lucide-react";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { queryGeneralLedger } from "@/actions/finance-ledger";
import { jakartaCurrentMonthRange, utcDateOnly } from "@/lib/finance-dates";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { GeneralLedgerClient } from "./general-ledger-client";

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const current = jakartaCurrentMonthRange();
  const from = sp.from ? new Date(sp.from) : current.from;
  const to = sp.to ? new Date(sp.to) : utcDateOnly(current.to);
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
    <FinancePageShell
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Buku besar" },
      ]}
      icon={<BookOpen className="size-5" />}
      title="Buku besar"
      description="Mutasi seluruh akun yang sudah diposting. Pilih satu akun untuk melihat saldo berjalan dan filter periode untuk drill-down."
    >
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
    </FinancePageShell>
  );
}
