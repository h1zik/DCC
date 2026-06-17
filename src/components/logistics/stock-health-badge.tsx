import { getStockHealth } from "@/lib/stock-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS = {
  CRITICAL: "Kritis",
  LOW: "Menipis",
  OK: "Aman",
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
  if (health === "CRITICAL") {
    return (
      <Badge variant="destructive" className={cn(className)}>
        {LABELS.CRITICAL}
      </Badge>
    );
  }
  if (health === "LOW") {
    return (
      <Badge variant="secondary" className={cn(className)}>
        {LABELS.LOW}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("border-emerald-500/40 text-emerald-700 dark:text-emerald-400", className)}>
      {LABELS.OK}
    </Badge>
  );
}
