import { getStockHealth } from "@/lib/stock-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS = {
  CRITICAL: "Kritis",
  LOW: "Menipis",
  OK: "Aman",
} as const;

const TONE_CLASS = {
  CRITICAL: "border-danger/40 bg-danger/10 text-danger",
  LOW: "border-warning/40 bg-warning/10 text-warning",
  OK: "border-success/40 bg-success/10 text-success",
} as const;

export function StockHealthBadge({
  currentStock,
  minStock,
  className,
}: {
  currentStock: number;
  minStock: number;
  className?: string;
}) {
  const health = getStockHealth(currentStock, minStock);
  return (
    <Badge variant="outline" className={cn(TONE_CLASS[health], className)}>
      {LABELS[health]}
    </Badge>
  );
}
