import { Wallet } from "lucide-react";
import { financeApAgingBuckets, listFinanceApBills, listFinanceArInvoices } from "@/actions/finance-ap-ar";
import { listFinanceBankAccounts } from "@/actions/finance-bank";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { prisma } from "@/lib/prisma";
import { ApArClient } from "./ap-ar-client";

export default async function ApArPage() {
  const [bills, invoices, banks, vendors, brands, aging] = await Promise.all([
    listFinanceApBills(),
    listFinanceArInvoices(),
    listFinanceBankAccounts(),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    financeApAgingBuckets(),
  ]);

  const agingProps = {
    current: aging.current.toString(),
    d1_30: aging.d1_30.toString(),
    d31_60: aging.d31_60.toString(),
    over60: aging.over60.toString(),
  };

  return (
    <FinancePageShell
      maxWidth="xl"
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Hutang & piutang" },
      ]}
      icon={<Wallet className="size-5" />}
      title="Hutang & piutang"
      description="Kelola tagihan supplier (AP), invoice pelanggan (AR), pencatatan pembayaran, dan pantau aging untuk arus kas yang sehat."
    >
      <ApArClient
        bills={bills.map((b) => ({
          id: b.id,
          vendorName: b.vendorName,
          billNumber: b.billNumber,
          dueDate: b.dueDate.toISOString(),
          amount: b.amount.toString(),
          status: b.status,
        }))}
        invoices={invoices.map((i) => ({
          id: i.id,
          customerName: i.customerName,
          invoiceNumber: i.invoiceNumber,
          dueDate: i.dueDate.toISOString(),
          amount: i.amount.toString(),
          status: i.status,
        }))}
        banks={banks.map((b) => ({ id: b.id, name: b.name }))}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        aging={agingProps}
      />
    </FinancePageShell>
  );
}
