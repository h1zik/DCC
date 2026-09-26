import { FinanceJournalStatus, Prisma } from "@prisma/client";
import { Scale } from "lucide-react";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { listFinanceBankAccounts } from "@/actions/finance-bank";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { signedBalanceForAccount } from "@/lib/finance-money";
import { prisma } from "@/lib/prisma";
import { CoaClient } from "./coa-client";

export default async function ChartOfAccountsPage() {
  const [rows, banks, sums] = await Promise.all([
    listFinanceAccounts({ includeInactive: true }),
    listFinanceBankAccounts(),
    // Saldo berjalan per akun dari jurnal terposting (sumber sama dengan GL).
    prisma.financeJournalLine.groupBy({
      by: ["accountId"],
      where: { entry: { status: FinanceJournalStatus.POSTED } },
      _sum: { debitBase: true, creditBase: true },
    }),
  ]);
  const bankByLedger = new Map(banks.map((b) => [b.ledgerAccountId, b]));
  const sumByAccount = new Map(sums.map((s) => [s.accountId, s._sum]));
  const zero = new Prisma.Decimal(0);

  return (
    <FinancePageShell
      icon={<Scale className="size-5" />}
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Chart of accounts" },
      ]}
      title="Chart of accounts"
      description="Kode, saldo, dan peran setiap akun yang dipakai jurnal dan laporan."
    >
      <CoaClient
        initialRows={rows.map((r) => {
          const bank = bankByLedger.get(r.id);
          const sum = sumByAccount.get(r.id);
          return {
            id: r.id,
            code: r.code,
            name: r.name,
            type: r.type,
            isActive: r.isActive,
            sortOrder: r.sortOrder,
            tracksCashflow: r.tracksCashflow,
            isApControl: r.isApControl,
            isArControl: r.isArControl,
            hasBankAccount: Boolean(bank),
            bankLabel: bank
              ? [bank.institution, bank.accountMask ? `··${bank.accountMask}` : null]
                  .filter(Boolean)
                  .join(" ") || null
              : null,
            balance: signedBalanceForAccount(
              r.type,
              sum?.debitBase ?? zero,
              sum?.creditBase ?? zero,
            ).toString(),
          };
        })}
      />
    </FinancePageShell>
  );
}
