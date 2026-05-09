import { ShieldCheck } from "lucide-react";
import { FinanceLedgerType } from "@prisma/client";
import { listFinanceSpendRequests } from "@/actions/finance-spend";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { listFinanceBankAccounts } from "@/actions/finance-bank";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { requireFinance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ApprovalsClient } from "./approvals-client";

export default async function FinanceApprovalsPage() {
  const session = await requireFinance();
  const [requests, expenseAccounts, banks, brands] = await Promise.all([
    listFinanceSpendRequests(),
    listFinanceAccounts(),
    listFinanceBankAccounts(),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);

  const expenses = expenseAccounts.filter((a) => a.type === FinanceLedgerType.EXPENSE);

  return (
    <FinancePageShell
      maxWidth="xl"
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Persetujuan" },
      ]}
      icon={<ShieldCheck className="size-5" />}
      title="Persetujuan pengeluaran"
      description="Alur kontrol pengeluaran: ajukan → kirim untuk review → disetujui Finance → pembayaran (otomatis menjadi jurnal terposting). Demi pemisahan tugas, Anda tidak dapat menyetujui atau membayar pengajuan yang Anda buat sendiri."
    >
      <ApprovalsClient
        currentUserId={session.user.id}
        requests={requests.map((r) => ({
          id: r.id,
          title: r.title,
          amount: r.amount.toString(),
          status: r.status,
          requestedById: r.requestedById,
          requestedBy: {
            name: r.requestedBy.name,
            email: r.requestedBy.email,
          },
        }))}
        expenseAccounts={expenses.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
        }))}
        banks={banks.map((b) => ({ id: b.id, name: b.name }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      />
    </FinancePageShell>
  );
}
