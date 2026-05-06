"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteFinanceJournalDraft,
  deleteFinanceJournalLine,
  postFinanceJournal,
  updateFinanceJournalHeader,
  upsertFinanceJournalLine,
} from "@/actions/finance-journals";
import type { FinanceJournalStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type JournalEditorAccount = {
  id: string;
  code: string;
  name: string;
};

export type JournalEditorBrand = { id: string; name: string };

export type JournalEditorLine = {
  id: string;
  accountId: string;
  debitBase: string;
  creditBase: string;
  memo: string | null;
  brandId: string | null;
  account: { code: string; name: string };
  brand: { id: string; name: string } | null;
};

function formatMoneyId(raw: string) {
  const n = Number(raw);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function JournalEditorClient(props: {
  entryId: string;
  status: FinanceJournalStatus;
  entryDateIso: string;
  reference: string | null;
  memo: string | null;
  lines: JournalEditorLine[];
  accounts: JournalEditorAccount[];
  brands: JournalEditorBrand[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entryDate, setEntryDate] = useState(props.entryDateIso.slice(0, 10));
  const [reference, setReference] = useState(props.reference ?? "");
  const [memo, setMemo] = useState(props.memo ?? "");

  const [accountId, setAccountId] = useState(props.accounts[0]?.id ?? "");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [lineMemo, setLineMemo] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const safeAccountId = props.accounts.some((a) => a.id === accountId)
    ? accountId
    : props.accounts[0]?.id ?? "__none__";
  const safeBrandId =
    brandId && props.brands.some((b) => b.id === brandId) ? brandId : "__none__";

  const isDraft = props.status === "DRAFT";

  function saveHeader() {
    startTransition(async () => {
      try {
        await updateFinanceJournalHeader({
          entryId: props.entryId,
          entryDate: new Date(entryDate),
          reference: reference || null,
          memo: memo || null,
        });
        toast.success("Header disimpan.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
      }
    });
  }

  function addLine() {
    startTransition(async () => {
      try {
        await upsertFinanceJournalLine({
          entryId: props.entryId,
          accountId,
          debit,
          credit,
          memo: lineMemo || null,
          brandId: brandId || null,
        });
        setDebit("");
        setCredit("");
        setLineMemo("");
        toast.success("Baris ditambahkan.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menambah baris.");
      }
    });
  }

  function removeLine(lineId: string) {
    startTransition(async () => {
      try {
        await deleteFinanceJournalLine(lineId);
        toast.success("Baris dihapus.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
      }
    });
  }

  function post() {
    startTransition(async () => {
      try {
        await postFinanceJournal(props.entryId);
        toast.success("Jurnal diposting.");
        router.push("/finance/journals");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Posting gagal.");
      }
    });
  }

  function removeDraft() {
    startTransition(async () => {
      try {
        await deleteFinanceJournalDraft(props.entryId);
        toast.success("Draf dihapus.");
        router.push("/finance/journals");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="jd">Tanggal</Label>
          <Input
            id="jd"
            type="date"
            value={entryDate}
            disabled={!isDraft}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jr">Referensi</Label>
          <Input
            id="jr"
            value={reference}
            disabled={!isDraft}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="jm">Memo</Label>
          <Input
            id="jm"
            value={memo}
            disabled={!isDraft}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
        {isDraft ? (
          <div className="sm:col-span-2">
            <Button type="button" size="sm" disabled={pending} onClick={saveHeader}>
              Simpan header
            </Button>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Akun</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Kredit</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="max-w-[220px] text-sm">
                  <span className="font-mono text-xs">{line.account.code}</span>{" "}
                  {line.account.name}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {Number(line.debitBase) > 0
                    ? formatMoneyId(line.debitBase)
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {Number(line.creditBase) > 0
                    ? formatMoneyId(line.creditBase)
                    : "—"}
                </TableCell>
                <TableCell className="text-xs">{line.brand?.name ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {isDraft ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={pending}
                      onClick={() => removeLine(line.id)}
                    >
                      Hapus
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {isDraft ? (
        <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border p-4">
          <h3 className="text-sm font-medium">Tambah baris</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Akun</Label>
              <Select
                value={safeAccountId}
                onValueChange={(v) =>
                  setAccountId(!v || v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih akun" />
                </SelectTrigger>
                <SelectContent>
                  {props.accounts.length === 0 ? (
                    <SelectItem value="__none__">Belum ada akun</SelectItem>
                  ) : null}
                  {props.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Debit (IDR)</Label>
              <Input value={debit} onChange={(e) => setDebit(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Kredit (IDR)</Label>
              <Input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Brand (opsional)</Label>
              <Select
                value={safeBrandId}
                onValueChange={(v) => setBrandId(!v || v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tanpa tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tanpa tag brand</SelectItem>
                  {props.brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Memo baris</Label>
              <Input value={lineMemo} onChange={(e) => setLineMemo(e.target.value)} />
            </div>
          </div>
          <Button
            type="button"
            disabled={pending || !accountId || safeAccountId === "__none__"}
            onClick={addLine}
          >
            Tambahkan baris
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isDraft ? (
          <>
            <Button type="button" disabled={pending} onClick={post}>
              Posting jurnal
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={removeDraft}>
              Hapus draf
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
