import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureAdminUserAccess } from "@/lib/ensure-ceo-admin-access";
import { ensureCustomRolesSeeded } from "@/lib/custom-roles";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { AdminUsersClient } from "./admin-users-client";

export default async function AdminUsersPage() {
  const session = await ensureAdminUserAccess();
  const currentUserId = session.user?.id;
  if (!currentUserId) {
    redirect("/login");
  }
  await ensureCustomRolesSeeded();

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        customRoleId: true,
        customRole: { select: { id: true, name: true, isProtected: true } },
      },
    }),
    prisma.customRole.findMany({
      // Sembunyikan role inti CEO dari pilihan reguler — peran CEO tidak dapat
      // ditetapkan dari halaman ini.
      where: { permissionTier: { not: UserRole.CEO } },
      orderBy: [{ isProtected: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        permissionTier: true,
        isProtected: true,
      },
    }),
  ]);

  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHero
        icon={Users}
        title="Pengguna"
        subtitle="Kelola akun internal dan peran pengguna. Tambah, ubah, dan tetapkan role langsung dari daftar."
        right={
          <>
            <PageHeroChip>
              <span className="text-foreground font-semibold tabular-nums">
                {users.length}
              </span>
              total
            </PageHeroChip>
            {counts.CEO ? (
              <PageHeroChip>
                <span className="bg-amber-500 size-1.5 rounded-full" aria-hidden />
                <span className="text-foreground font-semibold tabular-nums">
                  {counts.CEO}
                </span>
                CEO
              </PageHeroChip>
            ) : null}
            {counts.ADMINISTRATOR ? (
              <PageHeroChip>
                <span className="bg-sky-500 size-1.5 rounded-full" aria-hidden />
                <span className="text-foreground font-semibold tabular-nums">
                  {counts.ADMINISTRATOR}
                </span>
                Admin
              </PageHeroChip>
            ) : null}
          </>
        }
      />
      <AdminUsersClient
        users={users}
        roles={roles}
        currentUserId={currentUserId}
      />
    </div>
  );
}
