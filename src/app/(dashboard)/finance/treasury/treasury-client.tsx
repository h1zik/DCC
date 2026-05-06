"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createFinanceInternalTransfer } from "@/actions/finance-treasury";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Bank = { id: string; name: string };

type CfLine = {
  id: string;
  debitBase: string;
  creditBase: string;
  memo: string | null;
  account: { name: string; code: string };
  entry: { entryDate: string; reference: string | null };
};

export function TreasuryClient(props: { banks: Bank[]; cashflow: CfLine[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fromId, setFromId] = useState(props.banks[0]?.id ?? "");
  const [toId, setToId] = useState(props.banks[1]?.id ?? props.banks[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const safeFromId = props.banks.some((b) => b.id === fromId)
    ? fromId
    : props.banks[0]?.id ?? "__none__";
  const safeToId = props.banks.some((b) => b.id === toId)
    ? toId
    : props.banks[1]?.id ?? props.banks[0]?.id ?? "__none__";
  const fromLabel =
    props.banks.find((b) => b.id === safeFromId)?.name ??
    (safeFromId === "__none__" ? "Belum ada rekening" : "Pilih rekening asal");
  const toLabel =
    props.banks.find((b) => b.id === safeToId)?.name ??
    (safeToId === "__none__" ? "Belum ada rekening" : "Pilih rekening tujuan");

  useEffect(() => {
    if (safeFromId !== fromId && safeFromId !== "__none__") {
      setFromId(safeFromId);
    }
    if (safeToId !== toId && safeToId !== "__none__") {
      setToId(safeToId);
    }
  }, [fromId, toId, safeFromId, safeToId]);

  function transfer(e: React.FormEvent) {
    e.preventDefault();
    if (
      safeFromId === "__none__" ||
      safeToId === "__none__" ||
      safeFromId === safeToId
    ) {
      toast.error("Pilih rekening asal dan tujuan yang berbeda.");
      return;
    }
    startTransition(async () => {
      try {
        await createFinanceInternalTransfer({
          fromBankAccountId: safeFromId,
          toBankAccountId: safeToId,
          amount,
          transferDate: new Date(date),
          memo: memo || null,
        });
        toast.success("Transfer dicatat.");
        setAmount("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <form
        onSubmit={transfer}
        className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"
      >
        <div className="space-y-2">
          <Label>Dari rekening</Label>
          <Select
            value={safeFromId}
            onValueChange={(v) => setFromId(!v || v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <span className="line-clamp-1">{fromLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {props.banks.length === 0 ? (
                <SelectItem value="__none__">Belum ada rekening</SelectItem>
              ) : null}
              {props.banks.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ke rekening</Label>
          <Select
            value={safeToId}
            onValueChange={(v) => setToId(!v || v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <span className="line-clamp-1">{toLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {props.banks.length === 0 ? (
                <SelectItem value="__none__">Belum ada rekening</SelectItem>
              ) : null}
              {props.banks.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Nominal (IDR)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Tanggal</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Memo</Label>
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={
              pending ||
              props.banks.length < 2 ||
              safeFromId === "__none__" ||
              safeToId === "__none__" ||
              safeFromId === safeToId
            }
          >
            Catat transfer
          </Button>
          {props.banks.length < 2 ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Tambah minimal dua rekening di menu Rekonsiliasi bank.
            </p>
          ) : null}
        </div>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-medium">Arus kas (akun bertanda arus kas)</h3>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Akun</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Kredit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.cashflow.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                    Belum ada mutasi pada rentang ini.
                  </TableCell>
                </TableRow>
              ) : (
                props.cashflow.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.entry.entryDate.slice(0, 10)}</TableCell>
                    <TableCell className="text-xs">
                      {r.account.code} {r.account.name}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">
                      {r.entry.reference ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {fmt(r.debitBase)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {fmt(r.creditBase)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function fmt(raw: string) {
  const n = Number(raw);
  if (!n) return "—";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}
