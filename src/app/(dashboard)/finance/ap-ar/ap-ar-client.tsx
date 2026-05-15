"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createFinanceApBill,
  createFinanceArInvoice,
  recordApBillPayment,
  recordArInvoicePayment,
} from "@/actions/finance-ap-ar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Bill = {
  id: string;
  vendorName: string;
  billNumber: string | null;
  dueDate: string;
  amount: string;
  status: string;
};

type Inv = {
  id: string;
  customerName: string;
  invoiceNumber: string | null;
  dueDate: string;
  amount: string;
  status: string;
};

export function ApArClient(props: {
  bills: Bill[];
  invoices: Inv[];
  banks: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  aging: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [apVendorId, setApVendorId] = useState<string>("");
  const [apVendorName, setApVendorName] = useState("");
  const [apAmount, setApAmount] = useState("");
  const [apDue, setApDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [apBrand, setApBrand] = useState("");

  const [arCustomer, setArCustomer] = useState("");
  const [arAmount, setArAmount] = useState("");
  const [arDue, setArDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [arBrand, setArBrand] = useState("");
  const safeApVendorId =
    apVendorId && props.vendors.some((v) => v.id === apVendorId)
      ? apVendorId
      : "__manual__";
  const safeApBrandId =
    apBrand && props.brands.some((b) => b.id === apBrand) ? apBrand : "__none__";
  const safeArBrandId =
    arBrand && props.brands.some((b) => b.id === arBrand) ? arBrand : "__none__";
  const vendorLabel =
    safeApVendorId === "__manual__"
      ? "Ketik manual di bawah"
      : props.vendors.find((v) => v.id === safeApVendorId)?.name ??
        "Pilih vendor";
  const apBrandLabel =
    props.brands.find((b) => b.id === safeApBrandId)?.name ??
    "Tanpa brand";
  const arBrandLabel =
    props.brands.find((b) => b.id === safeArBrandId)?.name ??
    "Tanpa brand";

  function createBill(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const vendorName =
          apVendorName.trim() ||
          props.vendors.find((v) => v.id === apVendorId)?.name ||
          "";
        if (!vendorName) {
          toast.error("Pilih atau isi nama vendor.");
          return;
        }
        await createFinanceApBill({
          vendorId: apVendorId || null,
          vendorName,
          billNumber: null,
          billDate: new Date(),
          dueDate: new Date(apDue),
          amount: apAmount,
          memo: null,
          brandId: apBrand || null,
        });
        toast.success("Tagihan hutang dicatat.");
        setApVendorName("");
        setApAmount("");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal."));
      }
    });
  }

  function createInv(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createFinanceArInvoice({
          customerName: arCustomer,
          invoiceNumber: null,
          invoiceDate: new Date(),
          dueDate: new Date(arDue),
          amount: arAmount,
          memo: null,
          brandId: arBrand || null,
        });
        toast.success("Invoice piutang dicatat.");
        setArCustomer("");
        setArAmount("");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal."));
      }
    });
  }

  return (
    <Tabs defaultValue="ap">
      <TabsList>
        <TabsTrigger value="ap">Hutang (AP)</TabsTrigger>
        <TabsTrigger value="ar">Piutang (AR)</TabsTrigger>
      </TabsList>

      <TabsContent value="ap" className="flex flex-col gap-8 pt-4">
        <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <h3 className="text-sm font-medium">Aging hutang terbuka</h3>
            <div className="text-muted-foreground mt-2 grid gap-2 text-xs sm:grid-cols-4">
              <span>Jatuh tempo: {idr(props.aging.current)}</span>
              <span>1–30 hari: {idr(props.aging.d1_30)}</span>
              <span>31–60 hari: {idr(props.aging.d31_60)}</span>
              <span>&gt;60 hari: {idr(props.aging.over60)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={createBill} className="grid gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Vendor</Label>
            <Select
              value={safeApVendorId}
              onValueChange={(v) => {
                if (!v || v === "__manual__") {
                  setApVendorId("");
                  return;
                }
                setApVendorId(v);
                const n = props.vendors.find((x) => x.id === v)?.name ?? "";
                setApVendorName(n);
              }}
            >
              <SelectTrigger className="w-full">
                <span className="line-clamp-1">{vendorLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">Ketik manual di bawah</SelectItem>
                {props.vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Nama vendor (jika manual)</Label>
            <Input value={apVendorName} onChange={(e) => setApVendorName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Jumlah</Label>
            <Input value={apAmount} onChange={(e) => setApAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Jatuh tempo</Label>
            <Input type="date" value={apDue} onChange={(e) => setApDue(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Brand (opsional)</Label>
            <Select
              value={safeApBrandId}
              onValueChange={(v) => setApBrand(!v || v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <span className="line-clamp-1">{apBrandLabel}</span>
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
            <Button type="submit" disabled={pending}>
              Simpan tagihan AP
            </Button>
          </div>
        </form>

        <BillTable
          bills={props.bills}
          banks={props.banks}
          onPay={(billId, amount, bankId) => {
            startTransition(async () => {
              try {
                await recordApBillPayment({
                  billId,
                  amount,
                  bankAccountId: bankId,
                  paidAt: new Date(),
                });
                toast.success("Pembayaran dicatat.");
                router.refresh();
              } catch (err) {
                toast.error(actionErrorMessage(err, "Gagal."));
              }
            });
          }}
        />
      </TabsContent>

      <TabsContent value="ar" className="flex flex-col gap-8 pt-4">
        <form onSubmit={createInv} className="grid gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Pelanggan</Label>
            <Input value={arCustomer} onChange={(e) => setArCustomer(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Jumlah</Label>
            <Input value={arAmount} onChange={(e) => setArAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Jatuh tempo</Label>
            <Input type="date" value={arDue} onChange={(e) => setArDue(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Brand</Label>
            <Select
              value={safeArBrandId}
              onValueChange={(v) => setArBrand(!v || v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <span className="line-clamp-1">{arBrandLabel}</span>
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
            <Button type="submit" disabled={pending}>
              Simpan invoice AR
            </Button>
          </div>
        </form>

        <InvTable
          invoices={props.invoices}
          banks={props.banks}
          onReceive={(invoiceId, amount, bankId) => {
            startTransition(async () => {
              try {
                await recordArInvoicePayment({
                  invoiceId,
                  amount,
                  bankAccountId: bankId,
                  receivedAt: new Date(),
                });
                toast.success("Penerimaan dicatat.");
                router.refresh();
              } catch (err) {
                toast.error(actionErrorMessage(err, "Gagal."));
              }
            });
          }}
        />
      </TabsContent>
    </Tabs>
  );
}

function BillTable({
  bills,
  banks,
  onPay,
}: {
  bills: Bill[];
  banks: { id: string; name: string }[];
  onPay: (billId: string, amount: string, bankId: string) => void;
}) {
  const [payAmt, setPayAmt] = useState<Record<string, string>>({});
  const [bankId, setBankId] = useState<Record<string, string>>({});

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor</TableHead>
            <TableHead>Jatuh tempo</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Bayar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="text-sm">{b.vendorName}</TableCell>
              <TableCell className="text-xs">{b.dueDate.slice(0, 10)}</TableCell>
              <TableCell className="text-right text-xs">{idr(b.amount)}</TableCell>
              <TableCell className="text-xs">{b.status}</TableCell>
              <TableCell className="text-right">
                {b.status === "PAID" || b.status === "VOID" ? (
                  "—"
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <Input
                      className="h-7 w-28 text-right text-xs"
                      placeholder="Nominal"
                      value={payAmt[b.id] ?? ""}
                      onChange={(e) =>
                        setPayAmt((p) => ({ ...p, [b.id]: e.target.value }))
                      }
                    />
                    <Select
                      value={
                        bankId[b.id] && banks.some((bk) => bk.id === bankId[b.id])
                          ? bankId[b.id]
                          : banks[0]?.id ?? "__none__"
                      }
                      onValueChange={(v) =>
                        setBankId((p) => ({ ...p, [b.id]: v ?? "" }))
                      }
                    >
                      <SelectTrigger className="h-7 w-40 text-xs">
                        <span className="line-clamp-1">
                          {banks.find(
                            (bk) =>
                              bk.id ===
                              (bankId[b.id] && banks.some((x) => x.id === bankId[b.id])
                                ? bankId[b.id]
                                : banks[0]?.id ?? "__none__"),
                          )?.name ?? "Belum ada bank"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {banks.length === 0 ? (
                          <SelectItem value="__none__">Belum ada bank</SelectItem>
                        ) : null}
                        {banks.map((bk) => (
                          <SelectItem key={bk.id} value={bk.id}>
                            {bk.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="xs"
                      className="mt-1"
                      disabled={!banks.length}
                      onClick={() =>
                        onPay(b.id, payAmt[b.id] ?? "", bankId[b.id] ?? banks[0]?.id ?? "")
                      }
                    >
                      Bayar
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function InvTable({
  invoices,
  banks,
  onReceive,
}: {
  invoices: Inv[];
  banks: { id: string; name: string }[];
  onReceive: (invoiceId: string, amount: string, bankId: string) => void;
}) {
  const [amt, setAmt] = useState<Record<string, string>>({});
  const [bankId, setBankId] = useState<Record<string, string>>({});

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pelanggan</TableHead>
            <TableHead>Jatuh tempo</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Terima</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="text-sm">{inv.customerName}</TableCell>
              <TableCell className="text-xs">{inv.dueDate.slice(0, 10)}</TableCell>
              <TableCell className="text-right text-xs">{idr(inv.amount)}</TableCell>
              <TableCell className="text-xs">{inv.status}</TableCell>
              <TableCell className="text-right">
                {inv.status === "PAID" || inv.status === "VOID" ? (
                  "—"
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <Input
                      className="h-7 w-28 text-right text-xs"
                      placeholder="Nominal"
                      value={amt[inv.id] ?? ""}
                      onChange={(e) =>
                        setAmt((p) => ({ ...p, [inv.id]: e.target.value }))
                      }
                    />
                    <Select
                      value={
                        bankId[inv.id] && banks.some((bk) => bk.id === bankId[inv.id])
                          ? bankId[inv.id]
                          : banks[0]?.id ?? "__none__"
                      }
                      onValueChange={(v) =>
                        setBankId((p) => ({ ...p, [inv.id]: v ?? "" }))
                      }
                    >
                      <SelectTrigger className="h-7 w-40 text-xs">
                        <span className="line-clamp-1">
                          {banks.find(
                            (bk) =>
                              bk.id ===
                              (bankId[inv.id] && banks.some((x) => x.id === bankId[inv.id])
                                ? bankId[inv.id]
                                : banks[0]?.id ?? "__none__"),
                          )?.name ?? "Belum ada bank"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {banks.length === 0 ? (
                          <SelectItem value="__none__">Belum ada bank</SelectItem>
                        ) : null}
                        {banks.map((bk) => (
                          <SelectItem key={bk.id} value={bk.id}>
                            {bk.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="xs"
                      className="mt-1"
                      disabled={!banks.length}
                      onClick={() =>
                        onReceive(inv.id, amt[inv.id] ?? "", bankId[inv.id] ?? banks[0]?.id ?? "")
                      }
                    >
                      Terima
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
