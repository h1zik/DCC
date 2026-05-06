"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { financeBudgetVsActual, upsertFinanceBudgetLine } from "@/actions/finance-budget";
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

export function BudgetClient(props: {
  year: number;
  accounts: { id: string; code: string; name: string }[];
  brands: { id: string; name: string }[];
  initialVs: {
    budgetId: string;
    label: string;
    limit: string;
    actual: string;
    variance: string;
  }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(props.year);
  const [vs, setVs] = useState(props.initialVs);

  const [acct, setAcct] = useState("");
  const [brand, setBrand] = useState("");
  const [limit, setLimit] = useState("");
  const safeAcct =
    acct && props.accounts.some((a) => a.id === acct) ? acct : "__all__";
  const safeBrand =
    brand && props.brands.some((b) => b.id === brand) ? brand : "__all__";
  const acctLabel =
    safeAcct === "__all__"
      ? "Semua akun beban"
      : props.accounts.find((a) => a.id === safeAcct)
          ? `${props.accounts.find((a) => a.id === safeAcct)!.code} — ${props.accounts.find((a) => a.id === safeAcct)!.name}`
          : "Semua akun beban";
  const brandLabel =
    safeBrand === "__all__"
      ? "Semua brand"
      : props.brands.find((b) => b.id === safeBrand)?.name ?? "Semua brand";

  function saveLine(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await upsertFinanceBudgetLine({
          year,
          month,
          accountId: acct || null,
          brandId: brand || null,
          amountLimit: limit,
        });
        toast.success("Plafon disimpan.");
        setLimit("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal.");
      }
    });
  }

  function reloadVs() {
    startTransition(async () => {
      try {
        const rows = await financeBudgetVsActual({ year, month });
        setVs(
          rows.map((r) => ({
            budgetId: r.budgetId,
            label: r.label,
            limit: r.limit.toString(),
            actual: r.actual.toString(),
            variance: r.variance.toString(),
          })),
        );
      } catch {
        toast.error("Gagal memuat pembanding.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={saveLine} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-4">
        <div className="space-y-2">
          <Label>Tahun</Label>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label>Bulan</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-full">
              <span className="line-clamp-1">Bulan {month}</span>
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Akun beban (opsional)</Label>
          <Select
            value={safeAcct}
            onValueChange={(v) => setAcct(!v || v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <span className="line-clamp-1">{acctLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua akun beban</SelectItem>
              {props.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Brand (opsional)</Label>
          <Select
            value={safeBrand}
            onValueChange={(v) => setBrand(!v || v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <span className="line-clamp-1">{brandLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua brand</SelectItem>
              {props.brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Plafon (IDR)</Label>
          <Input value={limit} onChange={(e) => setLimit(e.target.value)} required />
        </div>
        <div className="flex items-end sm:col-span-4">
          <Button type="submit" disabled={pending}>
            Simpan plafon
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Budget vs aktual</h3>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={reloadVs}>
            Muat ulang
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Baris anggaran</TableHead>
                <TableHead className="text-right">Plafon</TableHead>
                <TableHead className="text-right">Aktual</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                    Tambah plafon di atas, lalu muat ulang.
                  </TableCell>
                </TableRow>
              ) : (
                vs.map((r) => (
                  <TableRow key={r.budgetId}>
                    <TableCell className="max-w-[240px] text-xs">{r.label}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{idr(r.limit)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{idr(r.actual)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{idr(r.variance)}</TableCell>
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

function idr(raw: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(raw));
}
