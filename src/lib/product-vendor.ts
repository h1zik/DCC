import type { ProductVendorRole } from "@prisma/client";

export const PRODUCT_VENDOR_ROLE_LABELS: Record<ProductVendorRole, string> = {
  MAKLON: "Maklon / filling",
  BOTTLE: "Botol / wadah",
  PACKAGING: "Packaging",
  RAW_MATERIAL: "Bahan baku",
  OTHER: "Lainnya",
};

export const PRODUCT_VENDOR_ROLE_ORDER: ProductVendorRole[] = [
  "MAKLON",
  "BOTTLE",
  "PACKAGING",
  "RAW_MATERIAL",
  "OTHER",
];

export type ProductVendorLinkInput = {
  vendorId: string;
  role: ProductVendorRole;
  roleLabel?: string | null;
  leadTimeDaysOverride?: number | null;
  sortOrder?: number;
};

export type ResolvedVendorLink = {
  vendorId: string;
  vendorName: string;
  role: ProductVendorRole;
  roleLabel: string | null;
  leadTimeDays: number | null;
  safetyStockDays: number;
  reviewPeriodDays: number;
};

export type VendorSnapshot = {
  id: string;
  name: string;
  leadTimeDays: number | null;
  safetyStockDays: number;
  reviewPeriodDays: number;
};

export type ProductVendorChainInput = {
  leadTimeDaysOverride: number | null;
  safetyStockDaysOverride: number | null;
  preferredVendor: VendorSnapshot | null;
  productVendors: Array<{
    role: ProductVendorRole;
    roleLabel: string | null;
    leadTimeDaysOverride: number | null;
    sortOrder: number;
    vendor: VendorSnapshot;
  }>;
};

export function productVendorRoleLabel(
  role: ProductVendorRole,
  roleLabel?: string | null,
): string {
  if (role === "OTHER" && roleLabel?.trim()) return roleLabel.trim();
  return PRODUCT_VENDOR_ROLE_LABELS[role];
}

export function resolveProductVendorLinks(
  product: ProductVendorChainInput,
): ResolvedVendorLink[] {
  if (product.productVendors.length > 0) {
    return [...product.productVendors]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((link) => ({
        vendorId: link.vendor.id,
        vendorName: link.vendor.name,
        role: link.role,
        roleLabel: link.roleLabel,
        leadTimeDays:
          link.leadTimeDaysOverride ?? link.vendor.leadTimeDays ?? null,
        safetyStockDays: link.vendor.safetyStockDays,
        reviewPeriodDays: link.vendor.reviewPeriodDays,
      }));
  }

  if (product.preferredVendor) {
    const v = product.preferredVendor;
    return [
      {
        vendorId: v.id,
        vendorName: v.name,
        role: "MAKLON",
        roleLabel: null,
        leadTimeDays: v.leadTimeDays,
        safetyStockDays: v.safetyStockDays,
        reviewPeriodDays: v.reviewPeriodDays,
      },
    ];
  }

  return [];
}

export type ChainLeadTimeResult = {
  leadTimeDays: number | null;
  safetyStockDays: number;
  reviewPeriodDays: number;
  missingLeadTime: boolean;
  bottleneckVendorId: string | null;
  bottleneckVendorName: string | null;
};

/**
 * Lead time rantai = max semua vendor (semua komponen harus siap sebelum produksi jadi).
 */
export function resolveChainLeadTime(
  product: ProductVendorChainInput,
  links: ResolvedVendorLink[],
): ChainLeadTimeResult {
  const defaultSafety = 7;
  const defaultReview = 14;

  if (product.leadTimeDaysOverride != null) {
    const safety =
      product.safetyStockDaysOverride ??
      (links.length > 0
        ? Math.max(...links.map((l) => l.safetyStockDays))
        : product.preferredVendor?.safetyStockDays ?? defaultSafety);
    const review =
      links.length > 0
        ? Math.max(...links.map((l) => l.reviewPeriodDays))
        : product.preferredVendor?.reviewPeriodDays ?? defaultReview;
    const bottleneck = links.reduce<ResolvedVendorLink | null>((best, link) => {
      if (link.leadTimeDays == null) return best;
      if (!best || (best.leadTimeDays ?? 0) < link.leadTimeDays) return link;
      return best;
    }, null);

    return {
      leadTimeDays: product.leadTimeDaysOverride,
      safetyStockDays: safety,
      reviewPeriodDays: review,
      missingLeadTime: false,
      bottleneckVendorId: bottleneck?.vendorId ?? product.preferredVendor?.id ?? null,
      bottleneckVendorName:
        bottleneck?.vendorName ?? product.preferredVendor?.name ?? null,
    };
  }

  if (links.length === 0) {
    return {
      leadTimeDays: null,
      safetyStockDays: product.safetyStockDaysOverride ?? defaultSafety,
      reviewPeriodDays: defaultReview,
      missingLeadTime: true,
      bottleneckVendorId: null,
      bottleneckVendorName: null,
    };
  }

  const missingLeadTime = links.some((l) => l.leadTimeDays == null);
  if (missingLeadTime) {
    return {
      leadTimeDays: null,
      safetyStockDays:
        product.safetyStockDaysOverride ??
        Math.max(...links.map((l) => l.safetyStockDays)),
      reviewPeriodDays: Math.max(...links.map((l) => l.reviewPeriodDays)),
      missingLeadTime: true,
      bottleneckVendorId: null,
      bottleneckVendorName: null,
    };
  }

  const bottleneck = links.reduce((best, link) =>
    (link.leadTimeDays ?? 0) > (best.leadTimeDays ?? 0) ? link : best,
  );

  return {
    leadTimeDays: bottleneck.leadTimeDays,
    safetyStockDays:
      product.safetyStockDaysOverride ??
      Math.max(...links.map((l) => l.safetyStockDays)),
    reviewPeriodDays: Math.max(...links.map((l) => l.reviewPeriodDays)),
    missingLeadTime: false,
    bottleneckVendorId: bottleneck.vendorId,
    bottleneckVendorName: bottleneck.vendorName,
  };
}

export function formatProductVendorsSummary(
  links: ResolvedVendorLink[],
  maxItems = 3,
): string {
  if (links.length === 0) return "—";
  const parts = links.map(
    (l) => `${productVendorRoleLabel(l.role, l.roleLabel)}: ${l.vendorName}`,
  );
  if (parts.length <= maxItems) return parts.join(" · ");
  return `${parts.slice(0, maxItems).join(" · ")} +${parts.length - maxItems}`;
}

export function primaryPreferredVendorId(
  links: ProductVendorLinkInput[],
): string | null {
  const maklon = links.find((l) => l.role === "MAKLON");
  if (maklon) return maklon.vendorId;
  return links[0]?.vendorId ?? null;
}
