import Link from "next/link";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { AlertTriangle, Boxes, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExecCoreData } from "@/lib/executive-dashboard";
import { reorderStatusLabel } from "@/lib/reorder-forecast";
import { cn } from "@/lib/utils";

function AllClear({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        {icon}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export function ExecPoForecast({
  rows,
}: {
  rows: ExecCoreData["forecastPoSoon"];
}) {
  return (
    <Card className="min-h-[280px]">
      <CardHeader>
        <CardTitle>SKU perlu PO (forecast)</CardTitle>
        <CardDescription>
          Burn rate penjualan 90 hari + lead time vendor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <AllClear
            icon={<Package className="size-5" />}
            title="Stok aman minggu ini"
            text="Tidak ada SKU yang perlu PO menurut forecast."
          />
        ) : (
          <ScrollArea className="h-[220px] pr-3">
            <ul className="flex flex-col gap-2.5">
              {rows.map((f) => (
                <li
                  key={f.productId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {f.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {f.brandName} · stok {f.currentStock} · burn{" "}
                      <span className="font-mono tabular-nums">
                        {f.avgDailyDemand.toFixed(1)}/hari
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      variant={
                        f.status === "ORDER_NOW" ? "destructive" : "secondary"
                      }
                    >
                      {reorderStatusLabel(f.status)}
                    </Badge>
                    {f.orderByDate ? (
                      <p className="text-xs text-muted-foreground">
                        Order sebelum{" "}
                        <span className="font-medium text-foreground">
                          {format(new Date(f.orderByDate), "d MMM", {
                            locale: idLocale,
                          })}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export function ExecCriticalStock({ rows }: { rows: ExecCoreData["critical"] }) {
  return (
    <Card className="min-h-[280px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          Stok kritis
        </CardTitle>
        <CardDescription>
          Reorder segera — stok nol atau di bawah ambang kritis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <AllClear
            icon={<Boxes className="size-5" />}
            title="Tidak ada SKU kritis"
            text="Semua produk di atas ambang kritis."
          />
        ) : (
          <ScrollArea className="h-[220px] pr-3">
            <ul className="flex flex-col gap-2.5">
              {rows.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {p.brandName} · SKU {p.sku}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="destructive">Stok {p.currentStock}</Badge>
                    <Link
                      href="/inventory"
                      className="text-xs font-medium text-destructive underline-offset-4 hover:underline"
                    >
                      Reorder
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export function ExecMilestones({
  rows,
  avgPct,
}: {
  rows: ExecCoreData["milestones"];
  avgPct: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Progress milestone proyek</CardTitle>
          <CardDescription>
            Rata-rata{" "}
            <span className="font-semibold text-foreground">{avgPct}%</span> —
            pantau detail di Pipeline proyek.
          </CardDescription>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/projects" />}
          variant="outline"
          size="sm"
        >
          Buka pipeline
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada proyek ber-brand.
          </p>
        ) : (
          <ul className="space-y-3.5">
            {rows.map((p) => {
              const done = p.pct >= 100;
              return (
                <li key={p.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {p.name}
                      <span className="font-normal text-muted-foreground">
                        {" · "}
                        {p.brandName}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        done
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground",
                      )}
                    >
                      {p.pct}%
                    </span>
                  </div>
                  <Progress
                    value={p.pct}
                    className={cn(
                      "gap-0",
                      done && "[&_[data-slot=progress-indicator]]:bg-emerald-500",
                    )}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
