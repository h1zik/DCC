"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  saveKolCategory,
  saveKolEndorseType,
  setKolCategoryArchived,
  setKolEndorseTypeArchived,
} from "@/actions/kol-master";
import { KolBadge } from "@/components/kol-hub/kol-badges";
import { Field } from "@/components/kol-hub/kol-fields";
import { LabCard, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionErrorMessage } from "@/lib/action-error-message";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  kolCount: number;
};
type EndorseType = {
  id: string;
  name: string;
  description: string | null;
  isBarter: boolean;
  archived: boolean;
  scheduleCount: number;
};

type Form =
  | { kind: "category"; id?: string; name: string; description: string }
  | { kind: "type"; id?: string; name: string; description: string; isBarter: boolean };

function TaxonomyList<
  T extends { id: string; name: string; description: string | null; archived: boolean },
>({
  title,
  pending,
  rows,
  usage,
  extra,
  onAdd,
  onEdit,
  onToggle,
}: {
  title: string;
  pending: boolean;
  rows: T[];
  usage: (r: T) => string;
  extra?: (r: T) => React.ReactNode;
  onAdd: () => void;
  onEdit: (r: T) => void;
  onToggle: (r: T) => void;
}) {
  return (
    <section className={lab.section}>
      <div className="flex items-end justify-between">
        <h2 className={lab.sectionTitle}>{title}</h2>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus />
          Tambah
        </Button>
      </div>
      <LabCard className="p-0">
        {rows.length === 0 ? (
          <p className="text-muted-foreground p-5 text-sm">Belum ada.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {rows.map((r) => (
              <li
                key={r.id}
                className={cn("flex items-center gap-3 px-4 py-3", r.archived && "opacity-55")}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {r.name}
                    {extra?.(r)}
                    {r.archived ? <KolBadge tone="muted">Diarsipkan</KolBadge> : null}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {r.description ? `${r.description} · ` : ""}
                    {usage(r)}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium hover:underline"
                  onClick={() => onEdit(r)}
                >
                  Ubah
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => onToggle(r)}
                >
                  {r.archived ? "Pulihkan" : "Arsipkan"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </LabCard>
    </section>
  );
}


export function TaxonomyClient({
  categories,
  types,
}: {
  categories: Category[];
  types: EndorseType[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [pending, startTransition] = useTransition();

  function act(fn: () => Promise<void>, ok: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
        setForm(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <TaxonomyList
        pending={pending}
        title="Kategori KOL"
        rows={categories}
        usage={(c) => `${c.kolCount} KOL`}
        onAdd={() => setForm({ kind: "category", name: "", description: "" })}
        onEdit={(c) =>
          setForm({ kind: "category", id: c.id, name: c.name, description: c.description ?? "" })
        }
        onToggle={(c) =>
          act(
            () => setKolCategoryArchived(c.id, !c.archived),
            c.archived ? "Kategori dipulihkan." : "Kategori diarsipkan.",
          )
        }
      />
      <TaxonomyList
        pending={pending}
        title="Jenis endorse"
        rows={types}
        usage={(t) => `${t.scheduleCount} jadwal`}
        extra={(t) => (t.isBarter ? <KolBadge tone="info">Barter · rate 0</KolBadge> : null)}
        onAdd={() => setForm({ kind: "type", name: "", description: "", isBarter: false })}
        onEdit={(t) =>
          setForm({
            kind: "type",
            id: t.id,
            name: t.name,
            description: t.description ?? "",
            isBarter: t.isBarter,
          })
        }
        onToggle={(t) =>
          act(
            () => setKolEndorseTypeArchived(t.id, !t.archived),
            t.archived ? "Jenis endorse dipulihkan." : "Jenis endorse diarsipkan.",
          )
        }
      />

      <Dialog open={form != null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form?.kind === "category"
                ? form.id
                  ? "Ubah kategori"
                  : "Kategori baru"
                : form?.id
                  ? "Ubah jenis endorse"
                  : "Jenis endorse baru"}
            </DialogTitle>
          </DialogHeader>
          {form ? (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.kind === "category") {
                  act(
                    () =>
                      saveKolCategory(form.id ?? null, {
                        name: form.name,
                        description: form.description,
                      }),
                    "Kategori disimpan.",
                  );
                } else {
                  act(
                    () =>
                      saveKolEndorseType(form.id ?? null, {
                        name: form.name,
                        description: form.description,
                        isBarter: form.isBarter,
                      }),
                    "Jenis endorse disimpan.",
                  );
                }
              }}
            >
              <Field label="Nama" htmlFor="tx-name">
                <Input
                  id="tx-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={form.kind === "category" ? "Mis. Home & cleaning" : "Mis. Paid + produk"}
                  required
                />
              </Field>
              <Field label="Keterangan" htmlFor="tx-desc" optional>
                <Input
                  id="tx-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              {form.kind === "type" ? (
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={form.isBarter}
                    onCheckedChange={(v) => setForm({ ...form, isBarter: v === true })}
                  />
                  Barter — KOL dibayar produk, rate otomatis 0
                </Label>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={pending}>
                  Batal
                </Button>
                <Button type="submit" disabled={pending}>
                  Simpan
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
