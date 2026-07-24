import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MovementTypeBadge({
  type,
  className,
}: {
  type: "IN" | "OUT";
  className?: string;
}) {
  if (type === "IN") {
    return (
      <Badge
        variant="outline"
        className={cn("border-success/40 bg-success/10 text-success", className)}
      >
        <ArrowDownToLine aria-hidden />
        Masuk
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("text-foreground", className)}>
      <ArrowUpFromLine aria-hidden />
      Keluar
    </Badge>
  );
}
