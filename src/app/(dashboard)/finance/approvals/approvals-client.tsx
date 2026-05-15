"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FinanceSpendRequestStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  approveFinanceSpendRequest,
  createFinanceSpendRequest,
  recordFinanceSpendPayout,
  rejectFinanceSpendRequest,
  submitFinanceSpendRequest,
} from "@/actions/finance-spend";
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

type ReqRow = {
  id: string;
  title: string;
  amount: string;
  status: FinanceSpendRequestStatus;
  requestedById: string;
  requestedBy: { name: string | null; email: string | null };
};

export function ApprovalsClient(props: {
  currentUserId: string;
  requests: ReqRow[];
  expenseAccounts: { id: string; code: string; name: string }[];
  banks: { id: string; name: string }[];
  brands: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseId, setExpenseId] = useState(props.expenseAccounts[0]?.id ?? "");
  const [brandId, setBrandId] = useState("");
  const safeExpenseId = props.expenseAccounts.some((a) => a.id === expenseId)
    ? expenseId
    : "__none__";
  const safeBrandId = brandId && props.brands.some((b) => b.id === brandId)
    ? brandId
    : "__none__";
  const expenseLabel =
    props.expenseAccounts.find((a) => a.id === safeExpenseId)
      ? `${props.expenseAccounts.find((a) => a.id === safeExpenseId)!.code} — ${props.expenseAccounts.find((a) => a.id === safeExpenseId)!.name}`
      : "Pilih akun beban";
  const brandLabel =
    props.brands.find((b) => b.id === safeBrandId)?.name ?? "Tanpa brand";

  function createReq(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createFinanceSpendRequest({
          title,
          amount,
          expenseAccountId: expenseId,
          brandId: brandId || null,
        });
        toast.success("Pengajuan dibuat.");
        setTitle("");
        setAmount("");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={createReq} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Judul pengajuan</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Nominal</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Akun beban</Label>
          <Select
            value={safeExpenseId}
            onValueChange={(v) =>
              setExpenseId(!v || v === "__none__" ? "" : v)
            }
          >
            <SelectTrigger className="w-full">
              <span className="line-clamp-1">{expenseLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Pilih akun beban</SelectItem>
              {props.expenseAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Brand</Label>
          <Select
            value={safeBrandId}
            onValueChange={(v) => setBrandId(!v || v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <span className="line-clamp-1">{brandLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {props.brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={pending || !expenseId || safeExpenseId === "__none__"}
          >
            Simpan draf
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pengajuan</TableHead>
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-[200px]">
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {r.requestedBy.email}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{idr(r.amount)}</TableCell>
                <TableCell className="text-xs">{r.status}</TableCell>
                <TableCell className="text-right">
                  <RowActions
                    row={r}
                    banks={props.banks}
                    isOwnRequest={r.requestedById === props.currentUserId}
                    onAction={() => router.refresh()}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RowActions({
  row,
  banks,
  isOwnRequest,
  onAction,
}: {
  row: ReqRow;
  banks: { id: string; name: string }[];
  isOwnRequest: boolean;
  onAction: () => void;
}) {
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [rowPending, startRow] = useTransition();
  const safeBankId = banks.some((b) => b.id === bankId)
    ? bankId
    : banks[0]?.id ?? "__none__";
  const bankLabel =
    banks.find((b) => b.id === safeBankId)?.name ?? "Belum ada bank";

  function run(fn: () => Promise<void>) {
    startRow(async () => {
      try {
        await fn();
        toast.success("OK");
        onAction();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal"));
      }
    });
  }

  // Pesan tooltip ringkas untuk aksi yang tidak boleh dilakukan oleh requester.
  const ownTitle =
    "Tidak bisa: Anda adalah pembuat pengajuan ini (segregation of duties).";

  return (
    <div className="flex flex-col items-end gap-1">
      {row.status === FinanceSpendRequestStatus.DRAFT ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={rowPending}
          onClick={() =>
            run(async () => {
              await submitFinanceSpendRequest(row.id);
            })
          }
        >
          Ajukan
        </Button>
      ) : null}
      {row.status === FinanceSpendRequestStatus.SUBMITTED ? (
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            type="button"
            size="xs"
            disabled={rowPending || isOwnRequest}
            title={isOwnRequest ? ownTitle : undefined}
            onClick={() =>
              run(async () => {
                await approveFinanceSpendRequest(row.id);
              })
            }
          >
            Setujui
          </Button>
          <Button
            type="button"
            size="xs"
            variant="destructive"
            disabled={rowPending || isOwnRequest}
            title={isOwnRequest ? ownTitle : undefined}
            onClick={() =>
              run(async () => {
                await rejectFinanceSpendRequest(row.id, "Ditolak dari aplikasi");
              })
            }
          >
            Tolak
          </Button>
        </div>
      ) : null}
      {row.status === FinanceSpendRequestStatus.APPROVED ? (
        <div className="flex flex-col items-end gap-1">
          <Select
            value={safeBankId}
            onValueChange={(v) => setBankId(v ?? "")}
          >
            <SelectTrigger className="h-7 w-44 text-xs">
              <span className="line-clamp-1">{bankLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {banks.length === 0 ? (
                <SelectItem value="__none__">Belum ada bank</SelectItem>
              ) : null}
              {banks.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="xs"
            disabled={
              rowPending ||
              !bankId ||
              bankId === "__none__" ||
              isOwnRequest
            }
            title={isOwnRequest ? ownTitle : undefined}
            onClick={() =>
              run(async () => {
                await recordFinanceSpendPayout({
                  requestId: row.id,
                  bankAccountId: bankId,
                  paidAt: new Date(),
                });
              })
            }
          >
            Bayar
          </Button>
          {isOwnRequest ? (
            <span className="text-muted-foreground text-[10px]">
              Pengajuan sendiri — minta orang lain.
            </span>
          ) : null}
        </div>
      ) : null}
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
