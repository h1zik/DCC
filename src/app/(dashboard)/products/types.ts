import type { Brand, Product, ProductVendor, Vendor } from "@prisma/client";

export type ProductVendorRow = Pick<
  ProductVendor,
  "vendorId" | "role" | "roleLabel" | "leadTimeDaysOverride" | "sortOrder"
> & {
  vendor: Pick<
    Vendor,
    "id" | "name" | "leadTimeDays" | "safetyStockDays" | "reviewPeriodDays"
  >;
};

export type ProductRow = Product & {
  brand: Brand;
  preferredVendor?: { id: string; name: string } | null;
  productVendors: ProductVendorRow[];
};
