"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applySuggestedReorderPoint } from "@/actions/products";
import { actionErrorMessage } from "@/lib/action-error-message";
import type { ProductReorderForecast } from "@/lib/reorder-forecast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ApplyRopDialog({
  open,
  onOpenChange,
  target,
  windowDays,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ProductReorderForecast;
  windowDays: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onApply() {
    setPending(true);
    try {
      const result = await applySuggestedReorderPoint({
        productId: target.productId,
        windowDays,
      });
      toast.success(`Min. stok diupdate ke ${result.appliedMinStock} unit.`);
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menerapkan ROP."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terapkan ROP sebagai min. stok?</DialogTitle>
          <DialogDescription>
            {target.name} — ROP terhitung: <strong>{target.reorderPoint}</strong>{" "}
            unit (min. manual saat ini: {target.manualMinStock}).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Batal
          </Button>
          <Button onClick={onApply} disabled={pending}>
            {pending ? "Menyimpan…" : "Terapkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
