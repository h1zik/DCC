"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FlaskConical, RefreshCw } from "lucide-react";
import { ProductConceptMode } from "@prisma/client";
import { toast } from "sonner";
import { createProductConcept } from "@/actions/research-concept-lab";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: { value: ProductConceptMode; label: string; hint: string }[] = [
  {
    value: ProductConceptMode.AI_GENERATED,
    label: "AI menyusun konsep",
    hint: "AI membangun konsep lengkap dari kategori lalu menjalankan validasi.",
  },
  {
    value: ProductConceptMode.MANUAL,
    label: "Mulai dari draft kosong",
    hint: "Kamu mengisi sendiri isi konsep di halaman detail.",
  },
];

/** Form konsep baru (inline panel), pola sama dengan Product Discovery. */
export function NewConceptForm({
  id,
  onCancel,
  onCreated,
}: {
  id: string;
  onCancel?: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<ProductConceptMode>(ProductConceptMode.AI_GENERATED);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const isAi = mode === ProductConceptMode.AI_GENERATED;

  function handleCreate() {
    if (!title.trim() || !category.trim()) {
      toast.error("Isi judul konsep dan kategori dulu.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductConcept({
          mode,
          title,
          category,
          targetMarket: targetMarket || undefined,
          priceTargetMin: priceMin ? Number(priceMin) : undefined,
          priceTargetMax: priceMax ? Number(priceMax) : undefined,
        });
        toast.success(isAi ? "Konsep sedang disusun AI." : "Draft konsep dibuat.");
        onCreated();
        router.push(`/research-hub/concept-lab/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Konsep gagal dibuat."));
      }
    });
  }

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        lab.panel,
        "grid gap-5",
        "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
      )}
    >
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="rh-section-title">
          Konsep produk baru
        </h2>
        <p className="rh-lede">
          Konsep yang dibuat dari USP Analyzer otomatis membawa konteks riset.
          Dari sini, mulai dari kategori saja.
        </p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Cara membuat</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODE_OPTIONS.map((opt) => {
            const checked = mode === opt.value;
            return (
              <label
                key={opt.value}
                className={cn(
                  "border-border flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  checked
                    ? "border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_45%,var(--border))] bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_8%,transparent)]"
                    : "hover:bg-muted/60",
                )}
              >
                <input
                  type="radio"
                  name={`${id}-mode`}
                  value={opt.value}
                  checked={checked}
                  onChange={() => setMode(opt.value)}
                  className="accent-primary mt-0.5 size-4"
                  disabled={pending}
                />
                <span className="space-y-0.5">
                  <span className="block font-medium">{opt.label}</span>
                  <span className="rh-meta block">{opt.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>Judul konsep</Label>
          <Input
            id={`${id}-name`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Mis. "Serum brightening low-irritation"'
            disabled={pending}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-category`}>Kategori</Label>
          <Input
            id={`${id}-category`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder='Mis. "body serum brightening"'
            disabled={pending}
          />
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">
          Target <span className="text-muted-foreground font-normal">(opsional)</span>
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-market`}>Target market</Label>
            <Input
              id={`${id}-market`}
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value)}
              placeholder='Mis. "wanita 20–30, kulit sensitif"'
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-price-min`}>Harga minimum (Rp)</Label>
            <Input
              id={`${id}-price-min`}
              type="number"
              inputMode="numeric"
              min={0}
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-price-max`}>Harga maksimum (Rp)</Label>
            <Input
              id={`${id}-price-max`}
              type="number"
              inputMode="numeric"
              min={0}
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Batal
          </Button>
        ) : null}
        <Button onClick={handleCreate} disabled={pending}>
          {pending ? <RefreshCw className="animate-spin" aria-hidden /> : <FlaskConical aria-hidden />}
          {pending ? "Membuat…" : isAi ? "Susun konsep dengan AI" : "Buat draft"}
        </Button>
      </div>
    </section>
  );
}
