import type {
  ShopProductAttribute,
  ShopProductModel,
  ShopProductVariation,
} from "@/components/research-hub/shop-product-detail-panel";

/** Parse helpers for the rich product-detail JSON columns stored on a tracked product. */

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    : [];
}

export function parseShopProductAttributes(value: unknown): ShopProductAttribute[] {
  return asArray(value)
    .map((o) => ({ name: String(o.name ?? ""), value: String(o.value ?? "") }))
    .filter((a) => a.name && a.value);
}

export function parseShopProductVariations(value: unknown): ShopProductVariation[] {
  return asArray(value)
    .map((o) => ({
      name: String(o.name ?? ""),
      options: Array.isArray(o.options)
        ? o.options.map((x) => String(x)).filter(Boolean)
        : [],
    }))
    .filter((v) => v.name && v.options.length > 0);
}

export function parseShopProductModels(value: unknown): ShopProductModel[] {
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return asArray(value).map((o) => ({
    modelId: o.modelId != null ? String(o.modelId) : null,
    name: o.name != null ? String(o.name) : null,
    price: num(o.price),
    priceBeforeDiscount: num(o.priceBeforeDiscount),
    stock: num(o.stock),
    sold: num(o.sold),
  }));
}

export function parseShopProductRatingDistribution(
  value: unknown,
): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const star of ["5", "4", "3", "2", "1"]) {
    const raw = (value as Record<string, unknown>)[star];
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      out[star] = Math.round(raw);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
