import { ScrollText } from "lucide-react";
import { notFound } from "next/navigation";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import {
  listOpenFinanceApBills,
  listOpenFinanceArInvoices,
} from "@/actions/finance-ap-ar";
import {
  getFinanceJournalEntry,
  getFinanceJournalReversals,
} from "@/actions/finance-journals";
import { findPeriodLockForDate } from "@/lib/finance-period-lock";
import { prisma } from "@/lib/prisma";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import {
  JournalEditorClient,
  type JournalEditorLine,
} from "./journal-editor-client";

export default async function FinanceJournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [entry, accounts, brands, vendors, openBills, openInvoices] =
    await Promise.all([
      getFinanceJournalEntry(id),
      listFinanceAccounts(),
      prisma.brand.findMany({ orderBy: { name: "asc" } }),
      prisma.vendor.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      listOpenFinanceApBills(),
      listOpenFinanceArInvoices(),
    ]);

  if (!entry) notFound();

  const [reversalInfo, periodLock] = await Promise.all([
    getFinanceJournalReversals(entry.id),
    findPeriodLockForDate(entry.entryDate),
  ]);

  const lines: JournalEditorLine[] = entry.lines.map((l) => ({
    id: l.id,
    accountId: l.accountId,
    debitBase: l.debitBase.toString(),
    creditBase: l.creditBase.toString(),
    memo: l.memo,
    brandId: l.brandId,
    account: {
      code: l.account.code,
      name: l.account.name,
      isApControl: l.account.isApControl,
      isArControl: l.account.isArControl,
    },
    brand: l.brand ? { id: l.brand.id, name: l.brand.name } : null,
    attachments: l.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      uploadedAtIso: a.uploadedAt.toISOString(),
    })),
    link: l.link
      ? {
          mode: l.link.mode,
          vendorId: l.link.vendorId,
          partyName: l.link.partyName,
          partyEmail: l.link.partyEmail,
          docNumber: l.link.docNumber,
          docDateIso: l.link.docDate?.toISOString() ?? null,
          dueDateIso: l.link.dueDate?.toISOString() ?? null,
          billId: l.link.billId,
          invoiceId: l.link.invoiceId,
          createdBillId: l.link.createdBillId,
          createdInvoiceId: l.link.createdInvoiceId,
        }
      : null,
  }));

  const titleSuffix = entry.entryNumber
    ? ` · ${entry.entryNumber}`
    : entry.reference
      ? ` · ${entry.reference}`
      : "";

  return (
    <FinancePageShell
      maxWidth="lg"
      icon={<ScrollText className="size-5" />}
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Jurnal", href: "/finance/journals" },
        { label: entry.entryNumber ?? "Draf" },
      ]}
      title={`Jurnal${titleSuffix}`}
      description={
        entry.status === "POSTED"
          ? `Status: Posted${entry.postedAt ? " • " + new Date(entry.postedAt).toLocaleString("id-ID") : ""}`
          : "Status: Draf — sunting baris, lalu posting bila sudah seimbang."
      }
    >
      <JournalEditorClient
        entryId={entry.id}
        status={entry.status}
        entryNumber={entry.entryNumber}
        entryDateIso={entry.entryDate.toISOString()}
        reference={entry.reference}
        memo={entry.memo}
        lines={lines}
        accounts={accounts.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          isApControl: a.isApControl,
          isArControl: a.isArControl,
        }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        vendors={vendors}
        openBills={openBills}
        openInvoices={openInvoices}
        reversesEntry={reversalInfo?.reversesEntry ?? null}
        reversedBy={
          reversalInfo?.reversedBy.length
            ? {
                id: reversalInfo.reversedBy[0].id,
                entryNumber: reversalInfo.reversedBy[0].entryNumber,
              }
            : null
        }
        periodLockedReason={
          periodLock
            ? `Periode ${String(periodLock.month).padStart(2, "0")}-${periodLock.year} terkunci oleh ${periodLock.lockedBy?.name ?? periodLock.lockedBy?.email ?? "Finance"}.`
            : null
        }
      />
    </FinancePageShell>
  );
}
