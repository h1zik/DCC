import { prisma } from "@/lib/prisma";
import { ensureLogisticsPage } from "@/lib/ensure-logistics-page";
import { VendorsClient } from "./vendors-client";

export default async function VendorsPage() {
  await ensureLogisticsPage();
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendor maklon</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Direktori pabrik maklon: PIC, kontak, dan spesialisasi (parfum vs
          skincare).
        </p>
      </div>
      <VendorsClient vendors={vendors} />
    </div>
  );
}
