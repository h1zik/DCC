import Link from "next/link";
import { notFound } from "next/navigation";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { getFinanceJournalEntry } from "@/actions/finance-journals";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
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
  const [entry, accounts, brands] = await Promise.all([
    getFinanceJournalEntry(id),
    listFinanceAccounts(),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!entry) notFound();

  const lines: JournalEditorLine[] = entry.lines.map((l) => ({
    id: l.id,
    accountId: l.accountId,
    debitBase: l.debitBase.toString(),
    creditBase: l.creditBase.toString(),
    memo: l.memo,
    brandId: l.brandId,
    account: { code: l.account.code, name: l.account.name },
    brand: l.brand ? { id: l.brand.id, name: l.brand.name } : null,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <Link
            href="/finance/journals"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            ← Daftar jurnal
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            Jurnal {entry.reference ? `· ${entry.reference}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Status: {entry.status === "POSTED" ? "Posted" : "Draft"}
          </p>
        </div>
      </div>

      <JournalEditorClient
        entryId={entry.id}
        status={entry.status}
        entryDateIso={entry.entryDate.toISOString()}
        reference={entry.reference}
        memo={entry.memo}
        lines={lines}
        accounts={accounts.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
        }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
