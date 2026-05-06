"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createFinanceBankAccount,
  importBankStatementCsv,
} from "@/actions/finance-bank";
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

export function BankClient(props: {
  banks: {
    id: string;
    name: string;
    institution: string | null;
    ledgerAccount: { code: string; name: string };
  }[];
  assetAccounts: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [ledgerId, setLedgerId] = useState(props.assetAccounts[0]?.id ?? "");
  const [institution, setInstitution] = useState("");
  const [opening, setOpening] = useState("0");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));

  const [importBankId, setImportBankId] = useState(props.banks[0]?.id ?? "");
  const [csvName, setCsvName] = useState("mutasi.csv");
  const [csvText, setCsvText] = useState("");
  const safeLedgerId = props.assetAccounts.some((a) => a.id === ledgerId)
    ? ledgerId
    : props.assetAccounts[0]?.id ?? "__none__";
  const safeImportBankId = props.banks.some((b) => b.id === importBankId)
    ? importBankId
    : props.banks[0]?.id ?? "__none__";
  const ledgerLabel =
    props.assetAccounts.find((a) => a.id === safeLedgerId)?.name ??
    (safeLedgerId === "__none__" ? "Belum ada akun aset" : "Pilih akun bank");
  const importBankLabel =
    props.banks.find((b) => b.id === safeImportBankId)?.name ??
    (safeImportBankId === "__none__" ? "Belum ada rekening" : "Pilih rekening");

  function createBank(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createFinanceBankAccount({
          name,
          ledgerAccountId: ledgerId,
          institution: institution || null,
          openingBalance: opening,
          openingAsOf: new Date(asOf),
        });
        toast.success("Rekening bank ditambahkan.");
        setName("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
      }
    });
  }

  function importCsv(e: React.FormEvent) {
    e.preventDefault();
    if (!importBankId || importBankId === "__none__") {
      toast.error("Buat rekening bank dulu.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await importBankStatementCsv({
          bankAccountId: importBankId,
          fileName: csvName,
          csvText,
        });
        toast.success(`Diimpor ${res.count} baris.`);
        setCsvText("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import gagal.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <form
        onSubmit={createBank}
        className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"
      >
        <div className="space-y-2 sm:col-span-2">
          <Label>Nama rekening</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Akun buku besar (Kas/Bank)</Label>
          <Select
            value={safeLedgerId}
            onValueChange={(v) =>
              setLedgerId(!v || v === "__none__" ? "" : v)
            }
          >
            <SelectTrigger className="w-full">
              <span className="line-clamp-1">{ledgerLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {props.assetAccounts.length === 0 ? (
                <SelectItem value="__none__">Belum ada akun aset</SelectItem>
              ) : null}
              {props.assetAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Institusi</Label>
          <Input value={institution} onChange={(e) => setInstitution(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Saldo awal</Label>
          <Input value={opening} onChange={(e) => setOpening(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Per tanggal</Label>
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            Simpan rekening
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Akun GL</TableHead>
              <TableHead>Bank</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.banks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground py-8 text-center text-sm">
                  Belum ada rekening.
                </TableCell>
              </TableRow>
            ) : (
              props.banks.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm font-medium">{b.name}</TableCell>
                  <TableCell className="text-xs">
                    {b.ledgerAccount.code} — {b.ledgerAccount.name}
                  </TableCell>
                  <TableCell className="text-xs">{b.institution ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4">
        <h3 className="text-sm font-medium">Impor mutasi CSV</h3>
        <p className="text-muted-foreground text-xs">
          Format per baris: tanggal, keterangan, jumlah (positif = uang masuk). Pisahkan dengan koma atau titik koma.
        </p>
        <form onSubmit={importCsv} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Rekening</Label>
              <Select
                value={safeImportBankId}
                onValueChange={(v) =>
                  setImportBankId(!v || v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="w-full">
                  <span className="line-clamp-1">{importBankLabel}</span>
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
              <Label>Nama berkas</Label>
              <Input value={csvName} onChange={(e) => setCsvName(e.target.value)} />
            </div>
          </div>
          <textarea
            className="border-input bg-background min-h-[140px] w-full rounded-lg border p-3 font-mono text-xs"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="2025-01-02,Transfer masuk,15000000"
          />
          <Button
            type="submit"
            disabled={pending || !importBankId || importBankId === "__none__"}
          >
            Impor
          </Button>
        </form>
      </div>
    </div>
  );
}
