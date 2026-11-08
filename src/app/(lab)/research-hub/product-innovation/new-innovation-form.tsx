"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Lightbulb, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createProductInnovation } from "@/actions/research-product-innovation";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectItemDef } from "@/lib/select-option-items";
import { lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

export type BaseConceptOption = {
  id: string;
  title: string;
  category: string;
};

const MODULE_OPTIONS = [
  { key: "reviewIntel", label: "Review Intel" },
  { key: "competitor", label: "Competitor" },
  { key: "trendRadar", label: "Trend Radar" },
  { key: "keywordIntel", label: "Keyword Intel" },
  { key: "socialListening", label: "Social Listening" },
] as const;

type ModuleKey = (typeof MODULE_OPTIONS)[number]["key"];

/** Form sesi SCAMPER baru (inline panel). */
export function NewInnovationForm({
  id,
  baseConcepts,
  onCancel,
  onCreated,
}: {
  id: string;
  baseConcepts: BaseConceptOption[];
  onCancel?: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [baseProduct, setBaseProduct] = useState("");
  const [category, setCategory] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [baseConceptId, setBaseConceptId] = useState<string>("none");
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    reviewIntel: true,
    competitor: true,
    trendRadar: true,
    keywordIntel: true,
    socialListening: true,
  });

  const baseConceptItems = useMemo(
    (): SelectItemDef[] => [
      { value: "none", label: "Tanpa basis konsep" },
      ...baseConcepts.map((c) => ({ value: c.id, label: c.title })),
    ],
    [baseConcepts],
  );

  function applyConcept(value: string | null) {
    const next = value ?? "none";
    setBaseConceptId(next);
    if (next !== "none") {
      const concept = baseConcepts.find((c) => c.id === next);
      if (concept) {
        if (!baseProduct.trim()) setBaseProduct(concept.title);
        if (!category.trim()) setCategory(concept.category);
      }
    }
  }

  function handleCreate() {
    if (!baseProduct.trim() || !category.trim()) {
      toast.error("Isi produk basis dan kategori dulu.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductInnovation({
          baseProduct,
          category,
          targetMarket: targetMarket || undefined,
          priceTargetMin: priceMin ? Number(priceMin) : undefined,
          priceTargetMax: priceMax ? Number(priceMax) : undefined,
          baseConceptId: baseConceptId !== "none" ? baseConceptId : undefined,
          sourceModules: modules,
        });
        toast.success("Ide SCAMPER sedang disusun AI.");
        onCreated();
        router.push(`/research-hub/product-innovation/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Sesi inovasi gagal dibuat."));
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
          Sesi SCAMPER baru
        </h2>
        <p className="rh-lede">
          Tentukan produk basis. AI menerapkan enam lensa SCAMPER dengan bukti
          dari modul riset yang kamu pilih. Ide terbaik bisa dijadikan konsep.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {baseConcepts.length > 0 ? (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-concept`}>
              Basis dari konsep <span className="text-muted-foreground font-normal">(opsional)</span>
            </Label>
            <Select value={baseConceptId} items={baseConceptItems} onValueChange={applyConcept}>
              <SelectTrigger id={`${id}-concept`}>
                <SelectValue placeholder="Tanpa basis konsep" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa basis konsep</SelectItem>
                {baseConcepts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-base`}>Produk basis</Label>
          <Input
            id={`${id}-base`}
            value={baseProduct}
            onChange={(e) => setBaseProduct(e.target.value)}
            placeholder='Mis. "Eau de parfum floral 50 ml"'
            disabled={pending}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-category`}>Kategori</Label>
          <Input
            id={`${id}-category`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder='Mis. "parfum"'
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

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Sumber bukti</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {MODULE_OPTIONS.map((m) => {
            const inputId = `${id}-module-${m.key}`;
            return (
              <div key={m.key} className="flex items-center gap-2">
                <Checkbox
                  id={inputId}
                  checked={modules[m.key]}
                  onCheckedChange={(v) => setModules((prev) => ({ ...prev, [m.key]: !!v }))}
                  disabled={pending}
                />
                <Label htmlFor={inputId} className="font-normal">
                  {m.label}
                </Label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Batal
          </Button>
        ) : null}
        <Button onClick={handleCreate} disabled={pending}>
          {pending ? <RefreshCw className="animate-spin" aria-hidden /> : <Lightbulb aria-hidden />}
          {pending ? "Memulai…" : "Susun ide SCAMPER"}
        </Button>
      </div>
    </section>
  );
}
