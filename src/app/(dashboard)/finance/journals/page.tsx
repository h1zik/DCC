import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Plus } from "lucide-react";
import { listFinanceJournalEntries, redirectNewFinanceJournal } from "@/actions/finance-journals";
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

export default async function FinanceJournalsPage() {
  const entries = await listFinanceJournalEntries({ take: 100 });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Jurnal</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Double-entry — draf dapat diedit; posting mengunci jurnal.
          </p>
        </div>
        <form action={redirectNewFinanceJournal}>
          <Button type="submit">
            <Plus className="mr-2 size-4" />
            Jurnal baru
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Referensi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Baris</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center text-sm">
                  Belum ada jurnal. Buat draf baru.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(e.entryDate, "d MMM yyyy", { locale: localeId })}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {e.reference ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.status === "POSTED" ? "default" : "secondary"}>
                      {e.status === "POSTED" ? "Posted" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {e._count.lines}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/finance/journals/${e.id}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Buka
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
