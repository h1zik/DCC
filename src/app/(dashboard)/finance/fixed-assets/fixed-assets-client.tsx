"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createFinanceFixedAsset,
  postFinanceDepreciationForMonth,
} from "@/actions/finance-assets";
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

type AssetRow = {
  id: string;
  name: string;
  category: string | null;
  cost: string;
  accumulatedDepreciation: string;
  usefulLifeMonths: number;
};

export function FixedAssetsClient(props: {
  assets: AssetRow[];
  accounts: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [life, setLife] = useState("36");
  const [assetAcc, setAssetAcc] = useState(
    props.accounts.find((a) => a.code === "1500")?.id ?? props.accounts[0]?.id ?? "",
  );
  const [accumAcc, setAccumAcc] = useState(
    props.accounts.find((a) => a.code === "1510")?.id ?? props.accounts[0]?.id ?? "",
  );
  const [expAcc, setExpAcc] = useState(
    props.accounts.find((a) => a.code === "6200")?.id ?? props.accounts[0]?.id ?? "",
  );
  const safeAssetAcc = props.accounts.some((a) => a.id === assetAcc)
    ? assetAcc
    : props.accounts[0]?.id ?? "__none__";
  const safeAccumAcc = props.accounts.some((a) => a.id === accumAcc)
    ? accumAcc
    : props.accounts[0]?.id ?? "__none__";
  const safeExpAcc = props.accounts.some((a) => a.id === expAcc)
    ? expAcc
    : props.accounts[0]?.id ?? "__none__";
  const assetAccLabel =
    props.accounts.find((a) => a.id === safeAssetAcc)
      ? `${props.accounts.find((a) => a.id === safeAssetAcc)!.code} — ${props.accounts.find((a) => a.id === safeAssetAcc)!.name}`
      : "Pilih akun aset";
  const accumAccLabel =
    props.accounts.find((a) => a.id === safeAccumAcc)
      ? `${props.accounts.find((a) => a.id === safeAccumAcc)!.code} — ${props.accounts.find((a) => a.id === safeAccumAcc)!.name}`
      : "Pilih akun akumulasi";
  const expAccLabel =
    props.accounts.find((a) => a.id === safeExpAcc)
      ? `${props.accounts.find((a) => a.id === safeExpAcc)!.code} — ${props.accounts.find((a) => a.id === safeExpAcc)!.name}`
      : "Pilih akun beban";

  const [depYear, setDepYear] = useState(new Date().getFullYear());
  const [depMonth, setDepMonth] = useState(new Date().getMonth() + 1);

  function createAsset(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createFinanceFixedAsset({
          name,
          category: null,
          purchaseDate: new Date(),
          cost,
          salvageValue: "0",
          usefulLifeMonths: Number(life),
          assetAccountId: assetAcc,
          accumAccountId: accumAcc,
          expenseAccountId: expAcc,
        });
        toast.success("Aset ditambahkan.");
        setName("");
        setCost("");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal."));
      }
    });
  }

  function runDep() {
    startTransition(async () => {
      try {
        await postFinanceDepreciationForMonth({ year: depYear, month: depMonth });
        toast.success("Penyusutan diposting.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={createAsset} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Nama aset</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Nilai perolehan</Label>
          <Input value={cost} onChange={(e) => setCost(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Umur manfaat (bulan)</Label>
          <Input type="number" value={life} onChange={(e) => setLife(e.target.value)} min={1} />
        </div>
        <div className="space-y-2">
          <Label>Akun aset</Label>
          <Select
            value={safeAssetAcc}
            onValueChange={(v) => setAssetAcc(!v || v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <span className="line-clamp-1">{assetAccLabel}</span>
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
          <Label>Akun akumulasi penyusutan</Label>
          <Select
            value={safeAccumAcc}
            onValueChange={(v) => setAccumAcc(!v || v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <span className="line-clamp-1">{accumAccLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {props.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Akun beban penyusutan</Label>
          <Select
            value={safeExpAcc}
            onValueChange={(v) => setExpAcc(!v || v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <span className="line-clamp-1">{expAccLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {props.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={
              pending ||
              safeAssetAcc === "__none__" ||
              safeAccumAcc === "__none__" ||
              safeExpAcc === "__none__"
            }
          >
            Simpan aset
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border p-4">
        <div className="space-y-2">
          <Label>Tahun penyusutan</Label>
          <Input type="number" value={depYear} onChange={(e) => setDepYear(Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Bulan</Label>
          <Input type="number" min={1} max={12} value={depMonth} onChange={(e) => setDepMonth(Number(e.target.value))} />
        </div>
        <Button type="button" variant="secondary" disabled={pending} onClick={runDep}>
          Posting penyusutan bulan ini
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aset</TableHead>
              <TableHead className="text-right">Perolehan</TableHead>
              <TableHead className="text-right">Akumulasi</TableHead>
              <TableHead className="text-right">Umur (bln)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                  Belum ada aset.
                </TableCell>
              </TableRow>
            ) : (
              props.assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">{a.name}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{idr(a.cost)}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{idr(a.accumulatedDepreciation)}</TableCell>
                  <TableCell className="text-right text-xs">{a.usefulLifeMonths}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function idr(raw: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(raw));
}
