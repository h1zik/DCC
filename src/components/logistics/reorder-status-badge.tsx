import { Badge } from "@/components/ui/badge";
import {
  reorderStatusLabel,
  type ReorderForecastStatus,
} from "@/lib/reorder-forecast";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<ReorderForecastStatus, string> = {
  ORDER_NOW: "border-danger/40 bg-danger/10 text-danger",
  ORDER_SOON: "border-warning/40 bg-warning/10 text-warning",
  OK: "border-success/40 bg-success/10 text-success",
  NO_DATA: "text-muted-foreground",
  NO_LEAD_TIME: "text-muted-foreground",
};

export function ReorderStatusBadge({
  status,
  className,
}: {
  status: ReorderForecastStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(TONE_CLASS[status], className)}>
      {reorderStatusLabel(status)}
    </Badge>
  );
}
