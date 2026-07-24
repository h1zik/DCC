"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StockLogType } from "@prisma/client";
import { toast } from "sonner";
import { updateStockLog } from "@/actions/stock";
import { actionErrorMessage } from "@/lib/action-error-message";
import { labeledItems, STOCK_LOG_TYPE_ITEMS } from "@/lib/select-option-items";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OUT_CATEGORIES, type SalesCategory, type StockLogRow } from "./types";

export function MovementCorrectionDialog({
  open,
  onOpenChange,
  log,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: StockLogRow;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(log.amount);
  const [type, setType] = useState<StockLogType>(log.type);
  const [salesCategory, setSalesCategory] = useState<SalesCategory | "">(
    log.type === StockLogType.OUT && log.salesCategory
      ? (log.salesCategory as SalesCategory)
      : "",
  );
  const [note, setNote] = useState(log.note ?? "");
  const [reference, setReference] = useState(log.reference ?? "");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const salesCategorySelectItems = useMemo(() => labeledItems(OUT_CATEGORIES), []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (type === StockLogType.OUT && !salesCategory) {
      toast.error("Kategori stok keluar wajib dipilih.");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Alasan koreksi minimal 3 karakter.");
      return;
    }
    setPending(true);
    try {
      await updateStockLog({
        logId: log.id,
        amount,
        type,
        salesCategory: type === StockLogType.OUT ? salesCategory || null : null,
        note: note || null,
        reference: reference || null,
        reason: reason.trim(),
      });
      toast.success("Koreksi mutasi berhasil dicatat.");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal memperbarui mutasi."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSave} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Koreksi mutasi</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {log.product.name} ·{" "}
            <span className="font-mono text-xs">{log.product.sku}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select
                value={type}
                items={STOCK_LOG_TYPE_ITEMS}
                onValueChange={(v) => v && setType(v as StockLogType)}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={StockLogType.IN}>Masuk</SelectItem>
                  <SelectItem value={StockLogType.OUT}>Keluar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Qty</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                disabled={pending}
              />
            </div>
          </div>
          {type === StockLogType.OUT ? (
            <div className="space-y-2">
              <Label>Kategori keluar</Label>
              <Select
                value={salesCategory}
                items={salesCategorySelectItems}
                onValueChange={(v) => v && setSalesCategory(v as SalesCategory)}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih" />
                </SelectTrigger>
                <SelectContent>
                  {OUT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Referensi</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label>Alasan koreksi</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Salah input jumlah…"
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={pending || reason.trim().length < 3}>
              {pending ? "Menyimpan…" : "Simpan koreksi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
