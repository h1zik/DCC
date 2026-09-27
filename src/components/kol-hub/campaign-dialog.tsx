"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveKolCampaign } from "@/actions/kol-master";
import { Field, KolSelect } from "@/components/kol-hub/kol-fields";
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
import { Textarea } from "@/components/ui/textarea";
import { actionErrorMessage } from "@/lib/action-error-message";
import { rupiahShort } from "@/lib/kol/format";

export type CampaignFormValue = {
  id?: string;
  brandId: string;
  budgetId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  picUserId: string;
};

export const EMPTY_CAMPAIGN: CampaignFormValue = {
  brandId: "",
  budgetId: "",
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  picUserId: "",
};

export function CampaignDialog({
  open,
  onOpenChange,
  initial,
  brands,
  budgets,
  users,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: CampaignFormValue;
  brands: { id: string; name: string }[];
  budgets: { id: string; name: string; brandId: string; remaining: number }[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, startTransition] = useTransition();
  const brandBudgets = budgets.filter((b) => b.brandId === v.brandId);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setV(initial);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Ubah campaign" : "Campaign baru"}</DialogTitle>
          <DialogDescription>
            Campaign mengelompokkan jadwal di bawah satu tujuan. Biaya tiap jadwal
            dipotong dari budget yang dipilih.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              try {
                await saveKolCampaign(initial.id ?? null, v);
                toast.success(initial.id ? "Campaign diperbarui." : "Campaign dibuat.");
                onOpenChange(false);
                router.refresh();
              } catch (err) {
                toast.error(actionErrorMessage(err, "Gagal menyimpan campaign."));
              }
            });
          }}
        >
          <Field label="Judul" htmlFor="cmp-title">
            <Input
              id="cmp-title"
              value={v.title}
              onChange={(e) => setV({ ...v, title: e.target.value })}
              placeholder="Mis. Launching Sabun Lantai Oktober"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand">
              <KolSelect
                ariaLabel="Brand"
                value={v.brandId}
                onChange={(brandId) => setV({ ...v, brandId, budgetId: "" })}
                options={brands.map((b) => ({ value: b.id, label: b.name }))}
              />
            </Field>
            <Field
              label="Budget"
              hint={
                v.brandId && brandBudgets.length === 0
                  ? "Brand ini belum punya budget — minta approver membuatnya di Master data › Budget."
                  : undefined
              }
            >
              <KolSelect
                ariaLabel="Budget"
                value={v.budgetId}
                disabled={!v.brandId}
                onChange={(budgetId) => setV({ ...v, budgetId })}
                placeholder={v.brandId ? "Pilih budget" : "Pilih brand dulu"}
                options={brandBudgets.map((b) => ({
                  value: b.id,
                  label: `${b.name} · sisa ${rupiahShort(b.remaining)}`,
                }))}
              />
            </Field>
            <Field label="Mulai" htmlFor="cmp-start" optional>
              <Input
                id="cmp-start"
                type="date"
                value={v.startDate}
                onChange={(e) => setV({ ...v, startDate: e.target.value })}
              />
            </Field>
            <Field label="Selesai" htmlFor="cmp-end" optional>
              <Input
                id="cmp-end"
                type="date"
                value={v.endDate}
                onChange={(e) => setV({ ...v, endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="PIC" optional>
            <KolSelect
              ariaLabel="PIC"
              value={v.picUserId}
              onChange={(picUserId) => setV({ ...v, picUserId })}
              emptyLabel="Tanpa PIC"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
          </Field>
          <Field label="Deskripsi" htmlFor="cmp-desc" optional>
            <Textarea
              id="cmp-desc"
              rows={3}
              value={v.description}
              onChange={(e) => setV({ ...v, description: e.target.value })}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending || !v.brandId || !v.budgetId}>
              {initial.id ? "Simpan" : "Buat campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
