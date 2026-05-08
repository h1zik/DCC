import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureAdminUserAccess } from "@/lib/ensure-ceo-admin-access";
import { ensureCustomRolesSeeded } from "@/lib/custom-roles";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { AdminRolesClient } from "./admin-roles-client";

export default async function AdminRolesPage() {
  const session = await ensureAdminUserAccess();
  if (!session.user?.id) redirect("/login");
  await ensureCustomRolesSeeded();

  const roles = await prisma.customRole.findMany({
    orderBy: [{ isProtected: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      permissionTier: true,
      isProtected: true,
      _count: { select: { users: true } },
    },
  });

  const protectedCount = roles.filter((r) => r.isProtected).length;
  const customCount = roles.length - protectedCount;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHero
        icon={ShieldCheck}
        title="Peran (role)"
        subtitle="Kelola label peran yang dapat diberikan ke pengguna. 4 peran inti (CEO, Administrator, Finance, Logistik) selalu ada — sisanya bisa kamu buat bebas dengan tier permission yang dipilih."
        right={
          <>
            <PageHeroChip>
              <span className="text-foreground font-semibold tabular-nums">
                {protectedCount}
              </span>
              inti
            </PageHeroChip>
            <PageHeroChip>
              <span className="text-foreground font-semibold tabular-nums">
                {customCount}
              </span>
              kustom
            </PageHeroChip>
          </>
        }
      />

      <AdminRolesClient roles={roles} />
    </div>
  );
}
