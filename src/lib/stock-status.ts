export type StockHealth = "OK" | "LOW" | "CRITICAL";

export function getStockHealth(currentStock: number, minStock: number): StockHealth {
  if (currentStock <= 0) return "CRITICAL";
  if (minStock > 0 && currentStock < minStock * 0.25) return "CRITICAL";
  if (minStock > 0 && currentStock <= minStock) return "LOW";
  return "OK";
}

export function needsUrgentReorder(currentStock: number, minStock: number): boolean {
  return getStockHealth(currentStock, minStock) === "CRITICAL";
}
