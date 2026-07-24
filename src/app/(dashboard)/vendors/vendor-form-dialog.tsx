"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Vendor } from "@prisma/client";
import { toast } from "sonner";
import { createVendor, updateVendor } from "@/actions/vendors";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/**
 * Dialog create/edit vendor bergaya seksi (Identitas / Kontak / Parameter PO).
 * Remount lewat `key` dari parent agar state form selalu segar per sesi.
 */
export function VendorFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Vendor | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(editing?.name ?? "");
  const [picName, setPicName] = useState(editing?.picName ?? "");
  const [contact, setContact] = useState(editing?.contact ?? "");
  const [specialty, setSpecialty] = useState(editing?.specialty ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState<number | "">(
    editing?.leadTimeDays ?? "",
  );
  const [safetyStockDays, setSafetyStockDays] = useState(
    editing?.safetyStockDays ?? 7,
  );
  const [reviewPeriodDays, setReviewPeriodDays] = useState(
    editing?.reviewPeriodDays ?? 14,
  );
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    try {
      const payload = {
        name,
        picName: picName || null,
        contact: contact || null,
        specialty: specialty || null,
        leadTimeDays: leadTimeDays === "" ? null : Number(leadTimeDays),
        safetyStockDays,
        reviewPeriodDays,
      };
      if (editing) {
        await updateVendor(editing.id, payload);
        toast.success("Vendor diperbarui.");
      } else {
        await createVendor(payload);
        toast.success("Vendor ditambahkan.");
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Gagal menyimpan vendor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit vendor" : "Vendor baru"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          {/* ─── Identitas ─── */}
          <div className="grid gap-3">
            <SectionLabel>Identitas</SectionLabel>
            <div className="space-y-2">
              <Label htmlFor="v-name">Nama</Label>
              <Input
                id="v-name"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama pabrik / vendor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-spec">Spesialisasi</Label>
              <Input
                id="v-spec"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Parfum, skincare…"
              />
            </div>
          </div>

          <Separator />

          {/* ─── Kontak ─── */}
          <div className="grid gap-3">
            <SectionLabel>Kontak</SectionLabel>
            <div className="space-y-2">
              <Label htmlFor="v-pic">PIC</Label>
              <Input
                id="v-pic"
                value={picName}
                onChange={(e) => setPicName(e.target.value)}
                placeholder="Nama penanggung jawab"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-contact">Kontak</Label>
              <Textarea
                id="v-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Telepon, email, alamat…"
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* ─── Parameter perencanaan PO ─── */}
          <div className="grid gap-3">
            <SectionLabel>Parameter perencanaan PO</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="v-lead">Lead time (hari)</Label>
                <Input
                  id="v-lead"
                  type="number"
                  min={0}
                  value={leadTimeDays}
                  onChange={(e) =>
                    setLeadTimeDays(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="14"
                />
                <p className="text-muted-foreground text-[11px] leading-snug">
                  Hari dari PO dikirim sampai barang masuk gudang.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-safety">Safety buffer (hari)</Label>
                <Input
                  id="v-safety"
                  type="number"
                  min={0}
                  value={safetyStockDays}
                  onChange={(e) => setSafetyStockDays(Number(e.target.value))}
                />
                <p className="text-muted-foreground text-[11px] leading-snug">
                  Cadangan permintaan (hari) untuk safety stock. Default 7.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-review">Review PO (hari)</Label>
                <Input
                  id="v-review"
                  type="number"
                  min={1}
                  value={reviewPeriodDays}
                  onChange={(e) => setReviewPeriodDays(Number(e.target.value))}
                />
                <p className="text-muted-foreground text-[11px] leading-snug">
                  Setiap berapa hari stok dicek untuk pemesanan ulang. Default
                  14.
                </p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg border p-3 text-xs text-muted-foreground">
              Ketiganya dipakai untuk menghitung reorder point &amp; tanggal PO
              di halaman Inventori.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button onClick={onSave} disabled={pending || !name.trim()}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
