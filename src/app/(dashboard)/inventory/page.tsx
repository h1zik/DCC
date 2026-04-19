import { prisma } from "@/lib/prisma";
import { ensureLogisticsPage } from "@/lib/ensure-logistics-page";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  await ensureLogisticsPage();
  const [products, logs] = await Promise.all([
    prisma.product.findMany({
      include: { brand: true },
      orderBy: { name: "asc" },
    }),
    prisma.stockLog.findMany({
      include: { product: { include: { brand: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventori</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ringkasan stok real-time, status alert, dan pencatatan masuk / keluar.
          Riwayat mutasi menampilkan hingga 1.000 entri terakhir — gunakan cetak
          laporan untuk arsip.
        </p>
      </div>
      <InventoryClient products={products} logs={logs} />
    </div>
  );
}
