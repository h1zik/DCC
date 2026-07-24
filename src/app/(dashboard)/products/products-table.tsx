"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Scale, Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StockHealthBadge } from "@/components/logistics/stock-health-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatProductVendorsSummary,
  resolveProductVendorLinks,
} from "@/lib/product-vendor";
import { PIPELINE_LABELS } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import type { ProductRow } from "./types";

export function ProductsTable({
  data,
  onEdit,
  onAdjust,
  onDelete,
}: {
  data: ProductRow[];
  onEdit: (product: ProductRow) => void;
  onAdjust: (product: ProductRow) => void;
  onDelete: (product: ProductRow) => void;
}) {
  const columns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Produk",
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.name}</span>
            <p className="text-muted-foreground font-mono text-[10px]">
              {row.original.sku}
            </p>
          </div>
        ),
      },
      { id: "brand", header: "Brand", cell: ({ row }) => row.original.brand.name },
      {
        id: "stock",
        header: "Stok",
        cell: ({ row }) => (
          <span className="text-base font-semibold tabular-nums">
            {row.original.currentStock}
          </span>
        ),
      },
      {
        id: "min",
        header: "Min.",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.minStock}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StockHealthBadge
            currentStock={row.original.currentStock}
            minStock={row.original.minStock}
          />
        ),
      },
      {
        id: "vendor",
        header: "Vendor",
        cell: ({ row }) => {
          const links = resolveProductVendorLinks({
            leadTimeDaysOverride: row.original.leadTimeDaysOverride,
            safetyStockDaysOverride: row.original.safetyStockDaysOverride,
            preferredVendor: row.original.preferredVendor
              ? {
                  id: row.original.preferredVendor.id,
                  name: row.original.preferredVendor.name,
                  leadTimeDays: null,
                  safetyStockDays: 7,
                  reviewPeriodDays: 14,
                }
              : null,
            productVendors: row.original.productVendors.map((pv) => ({
              role: pv.role,
              roleLabel: pv.roleLabel,
              leadTimeDaysOverride: pv.leadTimeDaysOverride,
              sortOrder: pv.sortOrder,
              vendor: {
                id: pv.vendor.id,
                name: pv.vendor.name,
                leadTimeDays: pv.vendor.leadTimeDays,
                safetyStockDays: pv.vendor.safetyStockDays,
                reviewPeriodDays: pv.vendor.reviewPeriodDays,
              },
            })),
          });
          return (
            <span className="text-muted-foreground max-w-[220px] text-xs leading-snug">
              {formatProductVendorsSummary(links, 2)}
            </span>
          );
        },
      },
      {
        id: "pipeline",
        header: "Pipeline",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {PIPELINE_LABELS[row.original.pipelineStage]}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "size-8",
              )}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Pencil className="size-4" />
                Edit master
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAdjust(row.original)}>
                <Scale className="size-4" />
                Sesuaikan stok
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(row.original)}
              >
                <Trash2 className="size-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [onEdit, onAdjust, onDelete],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      empty="Tidak ada produk yang cocok."
      sortable
      viewportMaxHeight="calc(100dvh - 320px)"
      stickyHeader
    />
  );
}
