"use client";

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
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Identitas Produk</h3>
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
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Positioning & Claims</h3>
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
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Formulation Direction</h3>
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
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Business Case</h3>
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
      </section>
    </div>
  );
}
