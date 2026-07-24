import { subDays } from "date-fns";
import { Boxes, Factory, PackageCheck, Timer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureLogisticsPage } from "@/lib/ensure-logistics-page";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { ExecutiveKpiCard } from "@/app/(dashboard)/executive-kpi-card";
import { VendorsClient } from "./vendors-client";

export default async function VendorsPage() {
  await ensureLogisticsPage();

  const since30d = subDays(new Date(), 30);
  const [vendors, receiptGroups] = await Promise.all([
    prisma.vendor.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            preferredByProducts: true,
            stockLogs: true,
          },
        },
      },
    }),
    prisma.stockLog.groupBy({
      by: ["vendorId"],
      where: {
        type: "IN",
        vendorId: { not: null },
        createdAt: { gte: since30d },
      },
      _count: { _all: true },
    }),
  ]);

  const receipts30d: Record<string, number> = {};
  for (const g of receiptGroups) {
    if (g.vendorId) receipts30d[g.vendorId] = g._count._all;
  }

  const totalVendors = vendors.length;
  const totalSku = vendors.reduce(
    (sum, v) => sum + v._count.preferredByProducts,
    0,
  );
  const totalReceipts30d = Object.values(receipts30d).reduce(
    (sum, n) => sum + n,
    0,
  );
  const withLeadTime = vendors.filter((v) => v.leadTimeDays != null);
  const missingLeadTime = totalVendors - withLeadTime.length;
  const avgLeadTime =
    withLeadTime.length > 0
      ? Math.round(
          withLeadTime.reduce((sum, v) => sum + (v.leadTimeDays ?? 0), 0) /
            withLeadTime.length,
        )
      : null;
  const leadTimeCoverage =
    totalVendors > 0 ? Math.round((withLeadTime.length / totalVendors) * 100) : 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHero
        variant="compact"
        icon={Factory}
        title="Vendor Maklon"
        subtitle="Direktori pabrik maklon: PIC, kontak, spesialisasi, dan parameter lead time untuk perencanaan PO."
      >
        <div className="flex flex-wrap gap-1.5 pt-1">
          <PageHeroChip>{totalVendors} vendor</PageHeroChip>
          <PageHeroChip>{totalSku} SKU terhubung</PageHeroChip>
        </div>
      </PageHero>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ExecutiveKpiCard
          label="Total vendor"
          value={totalVendors}
          description="pabrik maklon terdaftar"
          icon={<Factory className="size-4" />}
          tone="neutral"
        />
        <ExecutiveKpiCard
          label="Rata-rata lead time"
          value={avgLeadTime != null ? `${avgLeadTime} hari` : "—"}
          description={
            missingLeadTime > 0
              ? `${missingLeadTime} vendor belum diset lead time`
              : "semua vendor sudah diset lead time"
          }
          icon={<Timer className="size-4" />}
          tone={missingLeadTime > 0 ? "warning" : "success"}
          indicator={leadTimeCoverage}
        />
        <ExecutiveKpiCard
          label="SKU terhubung"
          value={totalSku}
          description="produk dengan vendor utama"
          icon={<Boxes className="size-4" />}
          tone="accent"
        />
        <ExecutiveKpiCard
          label="Penerimaan 30 hari"
          value={totalReceipts30d}
          description="log stok masuk 30 hari terakhir"
          icon={<PackageCheck className="size-4" />}
          tone="neutral"
        />
      </div>

      <VendorsClient vendors={vendors} receipts30d={receipts30d} />
    </div>
  );
}
