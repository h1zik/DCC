import Link from "next/link";
import { TaskStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  Clock,
  Factory,
  ListChecks,
  Package,
  Rocket,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStockHealth, needsUrgentReorder } from "@/lib/stock-status";
import { PIPELINE_LABELS, PIPELINE_ORDER } from "@/lib/pipeline";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

export default async function ExecutiveDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.CEO) redirect("/inventory");

  const products = await prisma.product.findMany({
    include: { brand: true },
    orderBy: { name: "asc" },
  });

  const [
    activeSuppliers,
    overdueTasks,
    readyLaunchProjects,
    pendingTaskApprovals,
    pendingPipelineApprovals,
  ] = await Promise.all([
    prisma.vendor.count(),
    prisma.task.count({ where: { status: TaskStatus.OVERDUE } }),
    prisma.project.count({
      where: { totalProgress: 100, brandId: { not: null } },
    }),
    prisma.task.count({
      where: { isApprovalRequired: true, isApproved: false },
    }),
    prisma.project.count({
      where: {
        pendingPipelineStage: { not: null },
        brandId: { not: null },
      } as never,
    }),
  ]);
  const pendingApprovals = pendingTaskApprovals + pendingPipelineApprovals;

  const activeSkus = products.length;

  const attentionCount = products.filter(
    (p) => getStockHealth(p.currentStock, p.minStock) !== "OK",
  ).length;

  const critical = products.filter((p) =>
    needsUrgentReorder(p.currentStock, p.minStock),
  );

  const pipelineCounts = PIPELINE_ORDER.map((stage) => ({
    stage,
    label: PIPELINE_LABELS[stage],
    count: products.filter((p) => p.pipelineStage === stage).length,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Executive overview
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          PT Dominatus Clean Solution — visibilitas stok, merek, dan jalur
          produksi.
        </p>
      </div>

      {critical.length > 0 ? (
        <Alert variant="destructive" className="border-destructive/60">
          <AlertTriangle className="size-4" />
          <AlertTitle>Prioritas mendesak</AlertTitle>
          <AlertDescription>
            {critical.length} SKU memerlukan tindakan reorder segera.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">SKU aktif</CardTitle>
            <Package className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{activeSkus}</p>
            <CardDescription>Total produk terdaftar</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Supplier aktif</CardTitle>
            <Factory className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {activeSuppliers}
            </p>
            <CardDescription>Vendor / maklon terdaftar</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stok perlu perhatian</CardTitle>
            <Boxes className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{attentionCount}</p>
            <CardDescription>Low atau critical vs ambang minimum</CardDescription>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tugas overdue</CardTitle>
            <Clock className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{overdueTasks}</p>
            <CardDescription>Seluruh proyek (Tahap 2)</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Siap peluncuran</CardTitle>
            <Rocket className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {readyLaunchProjects}
            </p>
            <CardDescription>Proyek progress 100%</CardDescription>
          </CardContent>
        </Card>
        <Card className="border-accent/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Menunggu persetujuan Anda
            </CardTitle>
            <ListChecks className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold tabular-nums">
              {pendingApprovals}
            </p>
            <p className="text-muted-foreground text-xs">
              Termasuk pengajuan pindah tahap pipeline proyek.
            </p>
            <Link
              href="/approvals"
              className="text-accent-foreground text-sm font-medium underline-offset-4 hover:underline"
            >
              Buka halaman persetujuan
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="min-h-[280px]">
          <CardHeader>
            <CardTitle>Stok kritis</CardTitle>
            <CardDescription>
              Reorder segera — stok nol atau di bawah ambang kritis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {critical.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Tidak ada SKU kritis saat ini.
              </p>
            ) : (
              <ScrollArea className="h-[220px] pr-3">
                <ul className="flex flex-col gap-3">
                  {critical.map((p) => (
                    <li
                      key={p.id}
                      className="bg-card flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {p.brand.name} · SKU {p.sku}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">
                          Stok {p.currentStock}
                        </Badge>
                        <span className="text-muted-foreground max-w-[140px] text-right text-xs">
                          Koordinasi reorder dengan staf logistik
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline produksi</CardTitle>
            <CardDescription>
              Ringkasan SKU per fase: Idea → Launch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {pipelineCounts.map(({ stage, label, count }) => (
                <div
                  key={stage}
                  className="bg-muted/40 flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-muted-foreground font-mono text-sm">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
