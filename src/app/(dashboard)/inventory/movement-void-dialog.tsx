"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StockLogType } from "@prisma/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { deleteStockLog } from "@/actions/stock";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StockLogRow } from "./types";

export function MovementVoidDialog({
  open,
  onOpenChange,
  log,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: StockLogRow;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      toast.error("Alasan void minimal 3 karakter.");
      return;
    }
    setPending(true);
    try {
      await deleteStockLog({ logId: log.id, reason: reason.trim() });
      toast.success("Mutasi di-void dengan jejak audit.");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal mem-void mutasi."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onConfirm} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Void mutasi</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {log.product.name} ·{" "}
            {log.type === StockLogType.IN ? "Masuk" : "Keluar"} {log.amount} unit
            — {format(log.createdAt, "d MMM yyyy HH:mm", { locale: idLocale })}
          </p>
          <div className="space-y-2">
            <Label>Alasan void (wajib)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Contoh: Duplikat entry, salah produk"
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
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || reason.trim().length < 3}
            >
              {pending ? "Memproses…" : "Konfirmasi void"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
