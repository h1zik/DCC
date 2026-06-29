"use client";

import { addCompetitorSkuToCompetitorTracker } from "@/actions/research-competitor-product";
import { CompetitorTrackerDialog } from "@/components/research-hub/competitor-tracker-dialog";

/**
 * Tombol "Tracker" untuk SKU pada halaman detail Competitor Shop.
 * Tipis di atas {@link CompetitorTrackerDialog}; sumber produk = CompetitorSku.
 */
export function CompetitorSkuTrackerDialog({
  skuId,
  productName,
  defaultCategoryName,
  disabled,
  className,
}: {
  skuId: string;
  productName: string;
  defaultCategoryName: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <CompetitorTrackerDialog
      productName={productName}
      defaultCategoryName={defaultCategoryName}
      disabled={disabled}
      className={className}
      onAdd={(args) => addCompetitorSkuToCompetitorTracker({ skuId, ...args })}
    />
  );
}
