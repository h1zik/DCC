import { prisma } from "@/lib/prisma";
import { ensureBrandPageAccess } from "@/lib/ensure-brand-page";
import { BrandsClient } from "./brands-client";

export default async function BrandsPage() {
  await ensureBrandPageAccess();
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brand</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Kelola merek B2C (Archipelago Scent, Umella, Divaon, dan lainnya).
          Akun administrator yang ditetapkan CEO dapat mengubah master brand.
        </p>
      </div>
      <BrandsClient brands={brands} />
    </div>
  );
}
