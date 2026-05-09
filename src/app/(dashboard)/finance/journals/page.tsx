import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowRight, FileText, Plus, ScrollText } from "lucide-react";
import {
  listFinanceJournalEntries,
  redirectNewFinanceJournal,
} from "@/actions/finance-journals";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { FinanceEmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import { prisma } from "@/lib/prisma";

export default async function FinanceJournalsPage() {
  const entries = await listFinanceJournalEntries({ take: 100 });

  // Compute total per entry (sum of debit side) for at-a-glance amount
  const totals = await prisma.financeJournalLine.groupBy({
    by: ["entryId"],
    where: { entryId: { in: entries.map((e) => e.id) } },
    _sum: { debitBase: true },
  });
  const totalById = new Map(
    totals.map((t) => [t.entryId, Number(t._sum.debitBase ?? 0)]),
  );

  return (
    <FinancePageShell
      maxWidth="xl"
      icon={<ScrollText className="size-5" />}
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Jurnal" },
      ]}
      title="Jurnal"
      description="Semua jurnal double-entry. Draf dapat disunting; jurnal terposting hanya bisa dikoreksi via pembalikan (reversing entry)."
      actions={
        <form action={redirectNewFinanceJournal}>
          <Button type="submit">
            <Plus className="size-3.5" /> Jurnal baru
          </Button>
        </form>
      }
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader sticky>
            <TableRow>
              <TableHead className="w-32">Nomor</TableHead>
              <TableHead className="w-28">Tanggal</TableHead>
              <TableHead>Memo / Referensi</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-20 text-right">Baris</TableHead>
              <TableHead className="w-36 text-right">Total</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-0">
                  <div className="py-6">
                    <FinanceEmptyState
                      icon={<FileText className="size-5" />}
                      title="Belum ada jurnal"
                      description="Mulai dengan membuat jurnal baru — minimal dua baris (debit & kredit) yang seimbang."
                      action={
                        <form action={redirectNewFinanceJournal}>
                          <Button type="submit" size="sm">
                            <Plus className="size-3.5" /> Jurnal baru
                          </Button>
                        </form>
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {e.entryNumber ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {format(e.entryDate, "d MMM yyyy", { locale: localeId })}
                  </TableCell>
                  <TableCell className="max-w-[420px]">
                    <Link
                      href={`/finance/journals/${e.id}`}
                      className="hover:text-primary line-clamp-1 text-sm font-medium transition-colors"
                    >
                      {e.memo?.trim() || e.reference?.trim() || "Tanpa keterangan"}
                    </Link>
                    {e.reference && e.memo ? (
                      <p className="text-muted-foreground line-clamp-1 text-[11px]">
                        Ref: {e.reference}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.status === "POSTED" ? "default" : "secondary"}>
                      {e.status === "POSTED" ? "Posted" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {e._count.lines}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    <Money value={totalById.get(e.id) ?? 0} zeroAsDash />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/finance/journals/${e.id}`}
                      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                      aria-label="Buka jurnal"
                    >
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </FinancePageShell>
  );
}
