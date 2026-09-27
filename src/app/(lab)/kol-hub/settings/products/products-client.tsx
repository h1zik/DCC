"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { setProductRetailPrice } from "@/actions/kol-master";
import { KolSelect, RupiahInput } from "@/components/kol-hub/kol-fields";
import { useUrlFilters } from "@/components/kol-hub/use-url-filters";
import { LabCard, LabEmptyState, LabToolbar } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/action-error-message";

type Product = {
  id: string;
  name: string;
  sku: string;
  brandName: string;
  retailPrice: number | null;
  usedInSchedules: number;
};

function PriceRow({ p }: { p: Product }) {
  const router = useRouter();
  const initial = p.retailPrice != null ? String(p.retailPrice) : "";
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = value !== initial;

  return (
    <tr className="align-middle">
      <td className="px-4 py-2.5">
        <p className="font-medium">{p.name}</p>
        <p className="text-muted-foreground text-xs">
          {p.sku} · {p.brandName}
        </p>
      </td>
      <td className="text-muted-foreground px-3 py-2.5 text-right text-xs tabular-nums">
        {p.usedInSchedules}
      </td>
      <td className="px-3 py-2.5">
        <form
          className="flex items-center justify-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              try {
                await setProductRetailPrice({ productId: p.id, retailPrice: value || null });
                toast.success(`Harga ${p.name} disimpan.`);
                router.refresh();
              } catch (err) {
                toast.error(actionErrorMessage(err, "Gagal menyimpan harga."));
              }
            });
          }}
        >
          <RupiahInput
            ariaLabel={`Harga ${p.name}`}
            value={value}
            onChange={setValue}
            className="w-40"
            placeholder="Belum diisi"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!dirty || pending}>
            Simpan
          </Button>
        </form>
      </td>
    </tr>
  );
}

export function ProductsPriceClient({
  products,
  brands,
}: {
  products: Product[];
  brands: { id: string; name: string }[];
}) {
  const { get, set } = useUrlFilters();
  return (
    <div className="flex flex-col gap-4">
      <LabToolbar>
        <KolSelect
          className="h-8 w-[200px] text-xs"
          ariaLabel="Filter brand"
          value={get("brand")}
          onChange={(v) => set({ brand: v })}
          emptyLabel="Semua brand"
          options={brands.map((b) => ({ value: b.id, label: b.name }))}
        />
      </LabToolbar>
      {products.length === 0 ? (
        <LabEmptyState
          icon={PackageSearch}
          title="Belum ada produk"
          description="Tambahkan produk di menu Products DCC, lalu kembali ke sini untuk mengisi harganya."
        />
      ) : (
        <LabCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border/70 text-left text-[11px]">
                <th className="px-4 py-2.5 font-medium">Produk</th>
                <th className="px-3 py-2.5 text-right font-medium">Dipakai jadwal</th>
                <th className="px-3 py-2.5 text-right font-medium">Harga jual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {products.map((p) => (
                <PriceRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        </LabCard>
      )}
    </div>
  );
}
