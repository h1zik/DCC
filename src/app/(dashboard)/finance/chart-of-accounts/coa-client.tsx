"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FinanceLedgerType } from "@prisma/client";
import { toast } from "sonner";
import { upsertFinanceLedgerAccount } from "@/actions/finance-accounts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type Row = {
  id: string;
  code: string;
  name: string;
  type: FinanceLedgerType;
  isActive: boolean;
  sortOrder: number;
  tracksCashflow: boolean;
};

const TYPE_LABEL: Record<FinanceLedgerType, string> = {
  ASSET: "Aktiva",
  LIABILITY: "Kewajiban",
  EQUITY: "Ekuitas",
  REVENUE: "Pendapatan",
  EXPENSE: "Beban",
};

export function CoaClient({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<FinanceLedgerType>(FinanceLedgerType.EXPENSE);
  const [tracksCashflow, setTracksCashflow] = useState(false);

  function createAccount(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await upsertFinanceLedgerAccount({
          code,
          name,
          type,
          tracksCashflow,
          sortOrder: 900,
          isActive: true,
        });
        setCode("");
        setName("");
        toast.success("Akun ditambahkan.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={createAccount}
        className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="space-y-2">
          <Label>Kode</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="font-mono"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Nama</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Tipe</Label>
          <Select
            value={type}
            onValueChange={(v) =>
              setType((v ?? "EXPENSE") as FinanceLedgerType)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2">
          <Checkbox
            id="tcf"
            checked={tracksCashflow}
            onCheckedChange={(c) => setTracksCashflow(!!c)}
          />
          <Label htmlFor="tcf" className="text-sm font-normal">
            Masuk pelacakan arus kas
          </Label>
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            Tambah akun
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Arus kas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.code}</TableCell>
                <TableCell className="text-sm">{r.name}</TableCell>
                <TableCell className="text-sm">{TYPE_LABEL[r.type]}</TableCell>
                <TableCell className="text-sm">{r.tracksCashflow ? "Ya" : "Tidak"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
