"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDownToLine, ArrowUpFromLine, BookPlus } from "lucide-react";
import { toast } from "sonner";
import {
  dismissStockNotice,
  recordStockNoticeToJournal,
  restoreStockNotice,
  type StockNoticeTab,
} from "@/actions/finance-stock-notices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { actionErrorMessage } from "@/lib/action-error-message";
import type { SelectItemDef } from "@/lib/select-option-items";

export type StockNoticeRow = {
  id: string;
  occurredAt: string;
  type: "IN" | "OUT";
  amount: number;
  productName: string;
  sku: string;
  brandName: string;
  salesCategory: string | null;
  salesCategoryKey: string | null;
  vendorName: string | null;
  reference: string | null;
  note: string | null;
  createdByName: string | null;
  journal: { id: string; status: "DRAFT" | "POSTED"; entryNumber: string | null } | null;
  dismissNote: string | null;
  handledByName: string | null;
};

type Account = { id: string; code: string; name: string };

const NONE = "__none__";

const dateTime = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

/**
 * Akun saran (kode COA bawaan) per jenis mutasi. Hanya titik awal — Finance
 * bebas menggantinya; kalau kodenya sudah tidak ada, pilihan dibiarkan kosong.
 */
function suggestedCodes(row: StockNoticeRow): { debit?: string; credit?: string } {
  if (row.type === "IN") return { debit: "1300" };
  switch (row.salesCategoryKey) {
    case "penjualan":
      return { debit: "5000", credit: "1300" };
    case "sampling":
      return { debit: "6100", credit: "1300" };
    case "rusak":
      return { debit: "6000", credit: "1300" };
    default:
      return { credit: "1300" };
  }
}

export function StockMovementsClient(props: {
  tab: StockNoticeTab;
  rows: StockNoticeRow[];
  accounts: Account[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [recording, setRecording] = useState<StockNoticeRow | null>(null);

  function run(fn: () => Promise<void>, ok: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal."));
      }
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Mutasi</TableHead>
              <TableHead>Rincian</TableHead>
              {props.tab !== "pending" ? <TableHead>Status</TableHead> : null}
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground align-top text-xs whitespace-nowrap">
                  {dateTime.format(new Date(r.occurredAt))}
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.type === "IN" ? "secondary" : "outline"}>
                      {r.type === "IN" ? (
                        <ArrowDownToLine aria-hidden />
                      ) : (
                        <ArrowUpFromLine aria-hidden />
                      )}
                      {r.type === "IN" ? "Masuk" : "Keluar"}
                    </Badge>
                    <span className="text-sm font-medium tabular-nums">
                      {r.amount.toLocaleString("id-ID")} unit
                    </span>
                  </div>
                  <div className="mt-1 text-sm">{r.productName}</div>
                  <div className="text-muted-foreground text-xs">
                    {r.sku} · {r.brandName}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[22rem] align-top text-xs whitespace-normal">
                  <RowDetails row={r} />
                </TableCell>
                {props.tab !== "pending" ? (
                  <TableCell className="align-top text-xs whitespace-normal">
                    {r.journal ? (
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={r.journal.status === "POSTED" ? "default" : "outline"}>
                          {r.journal.status === "POSTED" ? "Terposting" : "Draf jurnal"}
                        </Badge>
                        {r.journal.entryNumber ? (
                          <span className="text-muted-foreground tabular-nums">
                            {r.journal.entryNumber}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        {r.dismissNote ?? "Diabaikan tanpa catatan"}
                      </span>
                    )}
                    {r.handledByName ? (
                      <div className="text-muted-foreground mt-1">oleh {r.handledByName}</div>
                    ) : null}
                  </TableCell>
                ) : null}
                <TableCell className="align-top">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {r.journal ? (
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/finance/journals/${r.journal.id}`} />}
                      >
                        Buka jurnal
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => setRecording(r)}
                        >
                          <BookPlus aria-hidden />
                          Masukkan ke pencatatan
                        </Button>
                        {props.tab === "pending" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => dismissStockNotice({ noticeId: r.id }),
                                "Mutasi diabaikan. Bisa dipulihkan dari tab Diabaikan.",
                              )
                            }
                          >
                            Abaikan
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => restoreStockNotice(r.id),
                                "Mutasi dikembalikan ke antrean.",
                              )
                            }
                          >
                            Pulihkan
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={recording !== null}
        onOpenChange={(open) => {
          if (!open) setRecording(null);
        }}
      >
        {recording ? (
          <RecordDialog
            key={recording.id}
            row={recording}
            accounts={props.accounts}
            onClose={() => setRecording(null)}
          />
        ) : null}
      </Dialog>
    </>
  );
}

function RowDetails({ row }: { row: StockNoticeRow }) {
  const parts = [
    row.salesCategory ? `Kategori: ${row.salesCategory}` : null,
    row.vendorName ? `Vendor: ${row.vendorName}` : null,
    row.reference ? `Ref: ${row.reference}` : null,
    row.note,
    row.createdByName ? `Dicatat oleh ${row.createdByName}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return <span>—</span>;
  return (
    <ul className="space-y-0.5">
      {parts.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </ul>
  );
}

function RecordDialog({
  row,
  accounts,
  onClose,
}: {
  row: StockNoticeRow;
  accounts: Account[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const suggested = suggestedCodes(row);
  const idOfCode = (code?: string) =>
    (code && accounts.find((a) => a.code === code)?.id) || "";
  const [amount, setAmount] = useState("");
  const [debitId, setDebitId] = useState(idOfCode(suggested.debit));
  const [creditId, setCreditId] = useState(idOfCode(suggested.credit));

  const hasAmount = amount.trim() !== "";
  const incomplete = hasAmount && (!debitId || !creditId);
  const sameAccount = hasAmount && Boolean(debitId) && debitId === creditId;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const entryId = await recordStockNoticeToJournal({
          noticeId: row.id,
          amount: hasAmount ? amount : null,
          debitAccountId: debitId || null,
          creditAccountId: creditId || null,
        });
        toast.success("Draf jurnal dibuat. Periksa lalu posting.");
        router.push(`/finance/journals/${entryId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat draf jurnal."));
      }
    });
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Masukkan ke pencatatan</DialogTitle>
        <DialogDescription>
          {row.type === "IN" ? "Barang masuk" : "Barang keluar"}:{" "}
          {row.amount.toLocaleString("id-ID")} × {row.productName} ({row.sku}),{" "}
          {dateTime.format(new Date(row.occurredAt))}.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="stock-notice-amount">Nilai total (Rp)</Label>
          <Input
            id="stock-notice-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Contoh: 1.250.000"
            autoFocus
          />
          <p className="text-muted-foreground text-xs">
            Inventori tidak menyimpan harga pokok, jadi nilainya diisi di sini.
            Boleh dikosongkan untuk mengisi semua baris di editor jurnal.
          </p>
        </div>
        <AccountSelect
          label="Akun debit"
          value={debitId}
          onChange={setDebitId}
          accounts={accounts}
        />
        <AccountSelect
          label="Akun kredit"
          value={creditId}
          onChange={setCreditId}
          accounts={accounts}
        />
        {sameAccount ? (
          <p className="text-destructive text-xs">
            Akun debit dan kredit tidak boleh sama.
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Jurnal dibuat sebagai draf bertanggal mutasi. Pembelian secara hutang:
          tambahkan baris hutang usaha di editor jurnal.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending || incomplete || sameAccount}>
            {pending ? "Membuat draf…" : "Buat draf jurnal"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function AccountSelect({
  label,
  value,
  onChange,
  accounts,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  accounts: Account[];
}) {
  const safe = accounts.some((a) => a.id === value) ? value : NONE;
  const current = accounts.find((a) => a.id === safe);
  const items: SelectItemDef[] = [
    { value: NONE, label: "Pilih akun" },
    ...accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
  ];
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={safe}
        items={items}
        onValueChange={(v) => onChange(!v || v === NONE ? "" : v)}
      >
        <SelectTrigger className="w-full">
          <span className="line-clamp-1">
            {current ? `${current.code} — ${current.name}` : "Pilih akun"}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Pilih akun</SelectItem>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.code} — {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
