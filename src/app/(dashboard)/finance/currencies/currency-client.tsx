"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteFinanceFxRate,
  upsertFinanceFxRate,
} from "@/actions/finance-fx";
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

export function CurrencyClient({
  initialRates,
}: {
  initialRates: {
    id: string;
    currencyCode: string;
    rateToBase: string;
    validFrom: string;
  }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("USD");
  const [rate, setRate] = useState("");
  const [validFrom, setValidFrom] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  function addRate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await upsertFinanceFxRate({
          currencyCode: code,
          rateToBase: rate,
          validFrom: new Date(validFrom),
        });
        toast.success("Kurs disimpan.");
        setRate("");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteFinanceFxRate(id);
        toast.success("Kurs dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={addRate}
        className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-4"
      >
        <div className="space-y-2">
          <Label>Kode valas</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={3} />
        </div>
        <div className="space-y-2">
          <Label>Kurs ke IDR</Label>
          <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="16500" required />
        </div>
        <div className="space-y-2">
          <Label>Berlaku mulai</Label>
          <Input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            required
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending}>
            Simpan kurs
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Valas</TableHead>
              <TableHead className="text-right">1 unit → IDR</TableHead>
              <TableHead>Berlaku</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialRates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                  Belum ada kurs.
                </TableCell>
              </TableRow>
            ) : (
              initialRates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.currencyCode}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {Number(r.rateToBase).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-xs">{r.validFrom.slice(0, 10)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={pending}
                      onClick={() => remove(r.id)}
                    >
                      Hapus
                    </Button>
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
