import { prisma } from "@/lib/prisma";
import { ensureLogisticsPage } from "@/lib/ensure-logistics-page";
import { VendorsClient } from "./vendors-client";

export default async function VendorsPage() {
  await ensureLogisticsPage();
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          preferredByProducts: true,
          stockLogs: true,
        },
      },
    },
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendor maklon</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Direktori pabrik maklon — PIC, kontak, spesialisasi. Hubungkan ke produk
          sebagai vendor utama dan catat pada penerimaan stok masuk.
        </p>
      </div>
      <VendorsClient vendors={vendors} />
    </div>
  );
}
