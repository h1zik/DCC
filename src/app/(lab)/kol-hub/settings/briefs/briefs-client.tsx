"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowUpRight, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { archiveKolBrief, saveKolBrief } from "@/actions/kol-master";
import { KolBadge } from "@/components/kol-hub/kol-badges";
import { Field, KolSelect } from "@/components/kol-hub/kol-fields";
import { LabCard, LabEmptyState } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actionErrorMessage } from "@/lib/action-error-message";

type Brief = {
  id: string;
  title: string;
  brandId: string;
  brandName: string;
  categoryId: string | null;
  categoryName: string | null;
  linkUrl: string | null;
  description: string | null;
  scheduleCount: number;
};

type Form = {
  id?: string;
  brandId: string;
  categoryId: string;
  title: string;
  linkUrl: string;
  description: string;
};

export function BriefsClient({
  briefs,
  brands,
  categories,
}: {
  briefs: Brief[];
  brands: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() =>
            setForm({ brandId: "", categoryId: "", title: "", linkUrl: "", description: "" })
          }
        >
          <Plus />
          Brief baru
        </Button>
      </div>

      {briefs.length === 0 ? (
        <LabEmptyState
          icon={FileText}
          title="Belum ada brief"
          description="Brief dipilih per slot di schedule builder supaya KOL tahu apa yang harus dibuat."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {briefs.map((b) => (
            <LabCard key={b.id} className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <KolBadge tone="neutral">{b.brandName}</KolBadge>
                {b.categoryName ? <KolBadge tone="muted">{b.categoryName}</KolBadge> : null}
              </div>
              <p className="font-semibold">{b.title}</p>
              {b.description ? (
                <p className="text-muted-foreground line-clamp-3 text-sm">{b.description}</p>
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs">
                <span className="text-muted-foreground">Dipakai {b.scheduleCount} jadwal</span>
                <span className="flex items-center gap-3">
                  {b.linkUrl ? (
                    <a
                      href={b.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
                    >
                      Buka dokumen <ArrowUpRight className="size-3" aria-hidden />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() =>
                      setForm({
                        id: b.id,
                        brandId: b.brandId,
                        categoryId: b.categoryId ?? "",
                        title: b.title,
                        linkUrl: b.linkUrl ?? "",
                        description: b.description ?? "",
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
                          await archiveKolBrief(b.id);
                          toast.success("Brief diarsipkan.");
                          router.refresh();
                        } catch (err) {
                          toast.error(actionErrorMessage(err, "Gagal mengarsipkan brief."));
                        }
                      })
                    }
                  >
                    Arsipkan
                  </button>
                </span>
              </div>
            </LabCard>
          ))}
        </div>
      )}

      <Dialog open={form != null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Ubah brief" : "Brief baru"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  try {
                    await saveKolBrief(form.id ?? null, form);
                    toast.success(form.id ? "Brief diperbarui." : "Brief dibuat.");
                    setForm(null);
                    router.refresh();
                  } catch (err) {
                    toast.error(actionErrorMessage(err, "Gagal menyimpan brief."));
                  }
                });
              }}
            >
              <Field label="Judul" htmlFor="brf-title">
                <Input
                  id="brf-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Mis. Before–after lantai dapur"
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Brand">
                  <KolSelect
                    ariaLabel="Brand"
                    value={form.brandId}
                    onChange={(brandId) => setForm({ ...form, brandId })}
                    options={brands.map((b) => ({ value: b.id, label: b.name }))}
                  />
                </Field>
                <Field label="Kategori KOL" optional>
                  <KolSelect
                    ariaLabel="Kategori"
                    value={form.categoryId}
                    onChange={(categoryId) => setForm({ ...form, categoryId })}
                    emptyLabel="Semua kategori"
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </Field>
              </div>
              <Field label="Link dokumen brief" htmlFor="brf-link" optional>
                <Input
                  id="brf-link"
                  type="url"
                  placeholder="https://docs.google.com/…"
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                />
              </Field>
              <Field label="Ringkasan" htmlFor="brf-desc" optional>
                <Textarea
                  id="brf-desc"
                  rows={4}
                  placeholder="Pesan utama, do & don't, CTA, hashtag wajib"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={pending}>
                  Batal
                </Button>
                <Button type="submit" disabled={pending || !form.brandId}>
                  {form.id ? "Simpan" : "Buat brief"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
