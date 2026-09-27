"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Dialog aksi yang butuh alasan tertulis (tolak, batalkan, blacklist).
 * `required=false` membuat alasan opsional (mis. catatan saat menyetujui).
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Alasan",
  placeholder,
  confirmLabel,
  destructive,
  required = true,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  confirmLabel: string;
  destructive?: boolean;
  required?: boolean;
  pending?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const blocked = required && reason.trim().length < 3;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="kol-reason" className="text-xs">
            {label}
            {!required ? <span className="text-muted-foreground font-normal"> (opsional)</span> : null}
          </Label>
          <Textarea
            id="kol-reason"
            rows={3}
            autoFocus
            placeholder={placeholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={pending || blocked}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
