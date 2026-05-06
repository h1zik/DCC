"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { Prisma } from "@prisma/client";
import { FinanceLedgerType } from "@prisma/client";
import { signedBalanceForAccount } from "@/lib/finance-money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Line = {
  id: string;
  debitBase: string;
  creditBase: string;
  account: { code: string; name: string; type: FinanceLedgerType };
  entry: { entryDate: string; reference: string | null };
};

export function GeneralLedgerClient(props: {
  accounts: { id: string; code: string; name: string }[];
  lines: Line[];
  openingForSelected: string | null;
  selectedAccountId: string | null;
  fromIso: string;
  toIso: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    if (!props.selectedAccountId || props.openingForSelected === null) {
      return props.lines.map((line) => ({ line, balance: null as Prisma.Decimal | null }));
    }
    let run = new Prisma.Decimal(props.openingForSelected);
    return props.lines.map((line) => {
      const delta = signedBalanceForAccount(
        line.account.type,
        new Prisma.Decimal(line.debitBase),
        new Prisma.Decimal(line.creditBase),
      );
      run = run.plus(delta);
      return { line, balance: run };
    });
  }, [props.lines, props.openingForSelected, props.selectedAccountId]);

  function applyFilter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const accountVal = String(fd.get("accountId") ?? "");
    const from = String(fd.get("from") ?? "");
    const to = String(fd.get("to") ?? "");
    startTransition(() => {
      const q = new URLSearchParams(searchParams.toString());
      if (accountVal && accountVal !== "__all__") q.set("accountId", accountVal);
      else q.delete("accountId");
      q.set("from", from);
      q.set("to", to);
      router.push(`/finance/general-ledger?${q.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={applyFilter}
        className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-4"
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="accountId">Akun</Label>
          <select
            id="accountId"
            name="accountId"
            defaultValue={props.selectedAccountId ?? "__all__"}
            className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
          >
            <option value="__all__">Semua (tanpa saldo berjalan)</option>
            {props.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="from">Dari</Label>
          <Input
            id="from"
            name="from"
            type="date"
            required
            defaultValue={props.fromIso.slice(0, 10)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">Sampai</Label>
          <Input id="to" name="to" type="date" required defaultValue={props.toIso.slice(0, 10)} />
        </div>
        <div className="flex items-end sm:col-span-4">
          <Button type="submit" disabled={pending}>
            Terapkan
          </Button>
        </div>
      </form>

      {!props.selectedAccountId ? (
        <p className="text-muted-foreground text-sm">
          Pilih satu akun untuk menampilkan saldo awal dan saldo berjalan.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Saldo awal periode:{" "}
          <span className="text-foreground font-medium tabular-nums">
            {formatIdr(props.openingForSelected ?? "0")}
          </span>
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Akun</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Kredit</TableHead>
              <TableHead className="text-right">Saldo jalan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center text-sm">
                  Tidak ada mutasi pada filter ini.
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ line, balance }) => (
                <TableRow key={line.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {line.entry.entryDate.slice(0, 10)}
                  </TableCell>
                  <TableCell className="max-w-[220px] text-xs">
                    <span className="font-mono">{line.account.code}</span> {line.account.name}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-xs">
                    {line.entry.reference ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {fmt(line.debitBase)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {fmt(line.creditBase)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums font-medium">
                    {balance ? formatIdr(balance.toFixed(2)) : "—"}
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

function fmt(raw: string) {
  const n = Number(raw);
  if (!n) return "—";
  return formatIdr(raw);
}

function formatIdr(raw: string) {
  const n = Number(raw);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}
