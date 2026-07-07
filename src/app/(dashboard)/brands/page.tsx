import { Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureBrandPageAccess } from "@/lib/ensure-brand-page";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { BrandsClient } from "./brands-client";

export default async function BrandsPage() {
  await ensureBrandPageAccess();
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true, projects: true, rooms: true } },
    },
  });

  const withLogo = brands.filter((b) => Boolean(b.logo)).length;
  const totalProducts = brands.reduce((acc, b) => acc + b._count.products, 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHero
        icon={Building2}
        variant="compact"
        title="Brand"
        subtitle="Kelola merek B2C (Archipelago Scent, Umella, Divaon, dan lainnya). Akun administrator yang ditetapkan CEO dapat mengubah master brand."
        right={
          <>
            <PageHeroChip>
              <span className="text-foreground font-semibold tabular-nums">
                {brands.length}
              </span>
              brand
            </PageHeroChip>
            {withLogo > 0 ? (
              <PageHeroChip>
                <span className="text-foreground font-semibold tabular-nums">
                  {withLogo}
                </span>
                berlogo
              </PageHeroChip>
            ) : null}
            {totalProducts > 0 ? (
              <PageHeroChip>
                <span className="text-foreground font-semibold tabular-nums">
                  {totalProducts}
                </span>
                produk
              </PageHeroChip>
            ) : null}
          </>
        }
      />
      <BrandsClient brands={brands} />
    </div>
  );
}
