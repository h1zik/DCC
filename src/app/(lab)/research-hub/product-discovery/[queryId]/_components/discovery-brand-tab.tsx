"use client";

import { useMemo, useState } from "react";
import type { ResearchMarketplace } from "@prisma/client";
import { Search, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import {
  ResearchTable,
  SortableHead,
  useSortedRows,
} from "@/components/research-hub/kit/research-table";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import type { DiscoveryBrandRow } from "./discovery-types";

export function DiscoveryBrandTab({
  brands,
  inProgress,
}: {
  brands: DiscoveryBrandRow[];
  inProgress: boolean;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.shopName.toLowerCase().includes(q));
  }, [brands, query]);

  const { sorted, sort, toggle } = useSortedRows(visible, {
    name: (b) => b.shopName,
    products: (b) => b.productCount,
    rating: (b) => (b.avgRating > 0 ? b.avgRating : null),
    sold: (b) => b.totalSold,
  });

  if (brands.length === 0) {
    return (
      <ResearchPanelEmpty
        icon={Store}
        title="Belum ada data brand atau toko"
        description={
          inProgress
            ? "Daftar toko terisi setelah produk selesai ditarik."
            : "Produk hasil pencarian ini tidak mencantumkan nama toko. Ambil ulang produk atau coba keyword lain."
        }
      />
    );
  }

  return (
    <section aria-labelledby="pd-brands" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="pd-brands" className="rh-section-title">
            Brand atau toko dalam hasil
          </h2>
          <p className="rh-meta rh-num" aria-live="polite">
            {visible.length === brands.length
              ? `${brands.length} brand atau toko`
              : `${visible.length} dari ${brands.length} brand atau toko`}
          </p>
        </div>
        <div className="relative">
          <Label htmlFor="pd-brand-search" className="sr-only">
            Cari brand atau toko
          </Label>
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            id="pd-brand-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari brand atau toko"
            className="h-9 w-full pl-8 sm:w-56"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <ResearchPanelEmpty
          title="Tidak ada brand yang cocok"
          description={`Tidak ada brand atau toko yang mengandung "${query.trim()}". Ubah kata pencarian.`}
        />
      ) : (
        <ResearchTable>
          <TableHeader>
            <TableRow>
              <SortableHead sortKey="name" sort={sort} onSort={toggle}>
                Brand atau toko
              </SortableHead>
              <SortableHead sortKey="products" sort={sort} onSort={toggle} align="right">
                Produk
              </SortableHead>
              <SortableHead sortKey="rating" sort={sort} onSort={toggle} align="right">
                Rating rata-rata
              </SortableHead>
              <SortableHead sortKey="sold" sort={sort} onSort={toggle} align="right">
                Total terjual
              </SortableHead>
              <TableHead>Marketplace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((b) => (
              <TableRow key={b.shopName}>
                <TableCell className="font-medium">{b.shopName}</TableCell>
                <TableCell className="rh-num text-right">{b.productCount}</TableCell>
                <TableCell className="rh-num text-right">
                  {b.avgRating > 0 ? b.avgRating.toFixed(1) : "—"}
                </TableCell>
                <TableCell className="rh-num text-right">
                  {b.totalSold.toLocaleString("id-ID")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {b.marketplaces
                    .map((mp) => MARKETPLACE_LABELS[mp as ResearchMarketplace] ?? mp)
                    .join(", ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ResearchTable>
      )}
    </section>
  );
}
