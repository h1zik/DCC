"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConceptNameOptions } from "@/components/research-hub/concept-name-options";

export type ConceptFormData = {
  nameOptions: string[];
  selectedName?: string;
  positioningStatement: string;
  heroIngredients: { name: string; reason: string }[];
  textureFormat: string;
  keyClaims: string[];
  packagingDirection: string;
  estimatedCogsRange: { min: number; max: number };
  competitorComparison: string;
  whyItWillWin: string;
};

/** Blok langkah form ala bento: kartu nested + nomor langkah. */
function FormStep({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border/60 bg-muted/20 space-y-3 rounded-xl border p-4">
      <h3 className="flex items-center gap-2.5">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-xs font-bold tabular-nums text-[var(--lab-accent,var(--primary))]"
          aria-hidden
        >
          {step}
        </span>
        <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
          {title}
        </span>
      </h3>
      {children}
    </section>
  );
}

export function ConceptStepForm({
  data,
  onChange,
}: {
  data: ConceptFormData;
  onChange: (next: ConceptFormData) => void;
}) {
  function patch(partial: Partial<ConceptFormData>) {
    onChange({ ...data, ...partial });
  }

  return (
    <div className="space-y-4">
      <FormStep step={1} title="Identitas Produk">
        <ConceptNameOptions
          options={data.nameOptions}
          selected={data.selectedName}
          onSelect={(name) => patch({ selectedName: name })}
        />
        <div className="space-y-2">
          <Label>Nama terpilih (manual)</Label>
          <Input
            value={data.selectedName ?? ""}
            onChange={(e) => patch({ selectedName: e.target.value })}
            placeholder="Nama produk"
          />
        </div>
      </FormStep>

      <FormStep step={2} title="Positioning & Claims">
        <div className="space-y-2">
          <Label>Positioning statement</Label>
          <Textarea
            value={data.positioningStatement}
            onChange={(e) => patch({ positioningStatement: e.target.value })}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Key claims (pisahkan baris)</Label>
          <Textarea
            value={data.keyClaims.join("\n")}
            onChange={(e) =>
              patch({
                keyClaims: e.target.value.split("\n").filter(Boolean),
              })
            }
            rows={4}
          />
        </div>
      </FormStep>

      <FormStep step={3} title="Formulation Direction">
        <div className="space-y-2">
          <Label>Texture & format</Label>
          <Input
            value={data.textureFormat}
            onChange={(e) => patch({ textureFormat: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Hero ingredients (nama|alasan per baris)</Label>
          <Textarea
            value={data.heroIngredients
              .map((i) => `${i.name}|${i.reason}`)
              .join("\n")}
            onChange={(e) =>
              patch({
                heroIngredients: e.target.value
                  .split("\n")
                  .filter(Boolean)
                  .map((line) => {
                    const [name, ...rest] = line.split("|");
                    return { name: name?.trim() ?? line, reason: rest.join("|").trim() };
                  }),
              })
            }
            rows={4}
            placeholder="Niacinamide 5%|Brightening terbukti klinis"
          />
        </div>
        <div className="space-y-2">
          <Label>Packaging direction</Label>
          <Textarea
            value={data.packagingDirection}
            onChange={(e) => patch({ packagingDirection: e.target.value })}
            rows={2}
          />
        </div>
      </FormStep>

      <FormStep step={4} title="Business Case">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>COGS min (Rp)</Label>
            <Input
              type="number"
              value={data.estimatedCogsRange.min || ""}
              onChange={(e) =>
                patch({
                  estimatedCogsRange: {
                    ...data.estimatedCogsRange,
                    min: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>COGS max (Rp)</Label>
            <Input
              type="number"
              value={data.estimatedCogsRange.max || ""}
              onChange={(e) =>
                patch({
                  estimatedCogsRange: {
                    ...data.estimatedCogsRange,
                    max: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Competitor comparison</Label>
          <Textarea
            value={data.competitorComparison}
            onChange={(e) => patch({ competitorComparison: e.target.value })}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Why it will win</Label>
          <Textarea
            value={data.whyItWillWin}
            onChange={(e) => patch({ whyItWillWin: e.target.value })}
            rows={3}
          />
        </div>
      </FormStep>
    </div>
  );
}
