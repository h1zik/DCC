"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { archiveKolBudget, saveKolBudget } from "@/actions/kol-master";
import { BudgetMeter } from "@/components/kol-hub/budget-meter";
import { Field, KolSelect, RupiahInput } from "@/components/kol-hub/kol-fields";
import { LabCard, LabEmptyState, lab } from "@/components/lab/lab-primitives";
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
import { rupiah } from "@/lib/kol/format";
import type { BudgetRow } from "@/lib/kol/readers";
import { cn } from "@/lib/utils";

type Form = { id?: string; brandId: string; name: string; beginningBalance: string; notes: string };

export function BudgetsClient({
  budgets,
  brands,
  canEdit,
}: {
  budgets: BudgetRow[];
  brands: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    form &&
    startTransition(async () => {
      try {
        await saveKolBudget(form.id ?? null, {
          brandId: form.brandId,
          name: form.name,
          beginningBalance: form.beginningBalance,
          notes: form.notes,
        });
        toast.success(form.id ? "Budget diperbarui." : "Budget dibuat.");
        setForm(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan budget."));
      }
    });

  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => setForm({ brandId: "", name: "", beginningBalance: "", notes: "" })}
          >
            <Plus />
            Budget baru
          </Button>
        </div>
      ) : (
        <p className={cn(lab.nestedPanel, "text-muted-foreground text-sm")}>
          Budget dibuat dan diubah oleh approver KOL Hub.
        </p>
      )}

      {budgets.length === 0 ? (
        <LabEmptyState
          icon={Wallet}
          title="Belum ada budget"
          description="Buat budget per brand sebelum membuat campaign."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map((b) => (
            <LabCard key={b.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">{b.brandName}</p>
                  <p className="text-base font-semibold">{b.name}</p>
                </div>
                <p className="text-lg font-bold tabular-nums">{rupiah(b.beginning)}</p>
              </div>
              <BudgetMeter beginning={b.beginning} committed={b.committed} pending={b.pending} />
              {b.notes ? <p className="text-muted-foreground text-xs">{b.notes}</p> : null}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Dipakai {b.campaignCount} campaign</span>
                {canEdit ? (
                  <span className="flex gap-3">
                    <button
                      type="button"
                      className="font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
                      onClick={() =>
                        setForm({
                          id: b.id,
                          brandId: b.brandId,
                          name: b.name,
                          beginningBalance: String(b.beginning),
                          notes: b.notes ?? "",
                        })
                      }
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await archiveKolBudget(b.id);
                            toast.success("Budget diarsipkan.");
                            router.refresh();
                          } catch (err) {
                            toast.error(actionErrorMessage(err, "Gagal mengarsipkan budget."));
                          }
                        })
                      }
                    >
                      Arsipkan
                    </button>
                  </span>
                ) : null}
              </div>
            </LabCard>
          ))}
        </div>
      )}

      <Dialog open={form != null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Ubah budget" : "Budget baru"}</DialogTitle>
            <DialogDescription>
              Saldo awal tidak bisa diturunkan di bawah jumlah yang sudah terpakai.
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <Field label="Brand">
                <KolSelect
                  ariaLabel="Brand"
                  value={form.brandId}
                  onChange={(brandId) => setForm({ ...form, brandId })}
                  options={brands.map((b) => ({ value: b.id, label: b.name }))}
                />
              </Field>
              <Field label="Nama budget" htmlFor="bdg-name">
                <Input
                  id="bdg-name"
                  placeholder="Mis. KOL Q4 2026"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Saldo awal" htmlFor="bdg-amount">
                <RupiahInput
                  id="bdg-amount"
                  value={form.beginningBalance}
                  onChange={(beginningBalance) => setForm({ ...form, beginningBalance })}
                />
              </Field>
              <Field label="Catatan" htmlFor="bdg-notes" optional>
                <Textarea
                  id="bdg-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={pending}>
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={pending || !form.brandId || !form.beginningBalance}
                >
                  {form.id ? "Simpan" : "Buat budget"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
