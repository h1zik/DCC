"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adjustProductStock } from "@/actions/stock";
import { actionErrorMessage } from "@/lib/action-error-message";
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
import type { ProductRow } from "./types";

export function AdjustStockDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ProductRow;
}) {
  const router = useRouter();
  const [targetStock, setTargetStock] = useState(target.currentStock);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function onSave() {
    if (reason.trim().length < 3) {
      toast.error("Alasan penyesuaian minimal 3 karakter.");
      return;
    }
    setPending(true);
    try {
      await adjustProductStock({
        productId: target.id,
        targetStock,
        reason: reason.trim(),
      });
      toast.success("Stok disesuaikan dengan jejak audit.");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyesuaikan stok."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sesuaikan stok (stock opname)</DialogTitle>
          <DialogDescription>
            {target.name} · stok sistem: {target.currentStock} unit
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Stok fisik (hasil hitung)</Label>
            <Input
              type="number"
              min={0}
              value={targetStock}
              onChange={(e) => setTargetStock(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Alasan penyesuaian</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Stock opname Maret 2026"
            />
            <p className="text-muted-foreground text-xs">
              Selisih dicatat sebagai mutasi ledger dengan jejak audit.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={onSave}
            disabled={pending || reason.trim().length < 3}
          >
            {pending ? "Menyimpan…" : "Simpan penyesuaian"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
