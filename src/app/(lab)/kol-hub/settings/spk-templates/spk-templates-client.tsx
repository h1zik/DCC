"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, FileSignature, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  archiveSpkTemplate,
  createDefaultSpkTemplate,
  saveSpkTemplate,
} from "@/actions/kol-spk";
import { KolBadge } from "@/components/kol-hub/kol-badges";
import { Field, KolSelect } from "@/components/kol-hub/kol-fields";
import { LabCard, LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  DEFAULT_SPK_TEMPLATE,
  fillSpkVariables,
  SPK_SAMPLE_CONTEXT,
  SPK_VARIABLES,
  spkTextToHtml,
  unknownSpkVariables,
} from "@/lib/kol/spk-template";
import type { SpkTemplateRow } from "@/lib/kol/readers";
import { cn } from "@/lib/utils";

type Draft = {
  id?: string;
  name: string;
  scope: "ORGANIZATION" | "BRAND";
  brandId: string;
  body: string;
  isDefault: boolean;
};

function Editor({
  draft,
  brands,
  onClose,
}: {
  draft: Draft;
  brands: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState(draft);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const unknown = useMemo(() => unknownSpkVariables(v.body), [v.body]);
  const preview = useMemo(
    () => spkTextToHtml(fillSpkVariables(v.body, SPK_SAMPLE_CONTEXT)),
    [v.body],
  );

  // Sisipkan variabel di posisi kursor, lalu kembalikan fokus.
  function insert(key: string) {
    const el = ref.current;
    const token = `{{${key}}}`;
    if (!el) {
      setV({ ...v, body: `${v.body}${token}` });
      return;
    }
    const start = el.selectionStart ?? v.body.length;
    const end = el.selectionEnd ?? start;
    const body = v.body.slice(0, start) + token + v.body.slice(end);
    setV({ ...v, body });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <LabCard className="flex flex-col gap-4 p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px_200px]">
        <Field label="Nama template" htmlFor="spk-name">
          <Input id="spk-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="Berlaku untuk">
          <KolSelect
            ariaLabel="Cakupan template"
            value={v.scope}
            onChange={(scope) => setV({ ...v, scope: (scope || "ORGANIZATION") as Draft["scope"] })}
            options={[
              { value: "ORGANIZATION", label: "Semua brand" },
              { value: "BRAND", label: "Satu brand" },
            ]}
          />
        </Field>
        {v.scope === "BRAND" ? (
          <Field label="Brand">
            <KolSelect
              ariaLabel="Brand"
              value={v.brandId}
              onChange={(brandId) => setV({ ...v, brandId })}
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
            />
          </Field>
        ) : (
          <div />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium">Sisipkan data</p>
          {SPK_VARIABLES.map((g) => (
            <div key={g.id}>
              <p className="text-muted-foreground mb-1 text-[11px]">{g.label}</p>
              <div className="flex flex-wrap gap-1">
                {g.vars.map((x) => (
                  <button
                    key={x.key}
                    type="button"
                    title={`{{${x.key}}} — contoh: ${x.sample}`}
                    onClick={() => insert(x.key)}
                    className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] hover:bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_14%,transparent)] hover:text-[var(--lab-accent,var(--primary))]"
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Field
          label="Isi"
          htmlFor="spk-body"
          hint="# Judul, ## Subjudul, - butir daftar, **tebal**. Baris kosong = paragraf baru."
        >
          <Textarea
            id="spk-body"
            ref={ref}
            rows={24}
            className="font-mono text-xs leading-relaxed"
            value={v.body}
            onChange={(e) => setV({ ...v, body: e.target.value })}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium">Pratinjau dengan data contoh</p>
          <div
            className="spk-preview max-h-[560px] overflow-y-auto rounded-xl border border-border bg-white p-6 font-serif text-[13px] leading-relaxed text-neutral-900 [&_h1]:mb-1 [&_h1]:text-center [&_h1]:text-base [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-2"
            // Aman: spkTextToHtml meng-escape seluruh teks sebelum menambah tag.
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      </div>

      {unknown.length ? (
        <p className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-3.5" aria-hidden />
          Variabel tidak dikenal (akan kosong): {unknown.map((u) => `{{${u}}}`).join(", ")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox checked={v.isDefault} onCheckedChange={(c) => setV({ ...v, isDefault: c === true })} />
          Jadikan template utama untuk cakupan ini
        </Label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button
            disabled={pending || (v.scope === "BRAND" && !v.brandId)}
            onClick={() =>
              startTransition(async () => {
                try {
                  await saveSpkTemplate(v.id ?? null, { ...v, brandId: v.brandId || null });
                  toast.success("Template SPK disimpan.");
                  onClose();
                  router.refresh();
                } catch (err) {
                  toast.error(actionErrorMessage(err, "Gagal menyimpan template."));
                }
              })
            }
          >
            Simpan template
          </Button>
        </div>
      </div>
    </LabCard>
  );
}

export function SpkTemplatesClient({
  templates,
  brands,
}: {
  templates: SpkTemplateRow[];
  brands: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  if (draft) {
    return <Editor key={draft.id ?? "new"} draft={draft} brands={brands} onClose={() => setDraft(null)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() =>
            setDraft({ name: "", scope: "ORGANIZATION", brandId: "", body: DEFAULT_SPK_TEMPLATE, isDefault: templates.length === 0 })
          }
        >
          <Plus />
          Template baru
        </Button>
      </div>
      {templates.length === 0 ? (
        <LabEmptyState
          icon={FileSignature}
          title="Belum ada template SPK"
          description="Mulai dari template standar (bisa diubah kapan saja), lalu buat SPK dari halaman detail jadwal."
          action={
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await createDefaultSpkTemplate();
                    toast.success("Template standar dibuat.");
                    router.refresh();
                  } catch (err) {
                    toast.error(actionErrorMessage(err, "Gagal membuat template."));
                  }
                })
              }
            >
              Pakai template standar
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <LabCard key={t.id} className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-semibold">{t.name}</p>
                {t.isDefault ? <KolBadge tone="info">Utama</KolBadge> : null}
                <KolBadge tone="neutral">{t.scope === "BRAND" ? t.brandName : "Semua brand"}</KolBadge>
              </div>
              <p className={cn(lab.sectionDesc, "line-clamp-2 text-xs")}>
                {t.body.replace(/[#*{}]/g, "").slice(0, 160)}…
              </p>
              <div className="mt-auto flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Dipakai {t.documentCount} SPK</span>
                <span className="flex gap-3">
                  <button
                    type="button"
                    className="font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
                    onClick={() =>
                      setDraft({
                        id: t.id,
                        name: t.name,
                        scope: t.scope,
                        brandId: t.brandId ?? "",
                        body: t.body,
                        isDefault: t.isDefault,
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
                          await archiveSpkTemplate(t.id);
                          toast.success("Template diarsipkan.");
                          router.refresh();
                        } catch (err) {
                          toast.error(actionErrorMessage(err, "Gagal mengarsipkan."));
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
    </div>
  );
}
