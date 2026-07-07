import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureAdminUserAccess } from "@/lib/ensure-ceo-admin-access";
import { ensureCustomRolesSeeded } from "@/lib/custom-roles";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { AdminUsersClient } from "./admin-users-client";

// Selaras dengan /api/presence.
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function lastSeenLabel(lastSeenAt: Date | null, nowMs: number): string {
  if (!lastSeenAt) return "Belum pernah aktif";
  const diff = nowMs - lastSeenAt.getTime();
  if (Number.isNaN(diff) || diff < 0) return "Baru saja";
  if (diff < 60_000) return "Baru saja";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} menit lalu`;
  if (diff < 24 * 60 * 60_000)
    return `${Math.floor(diff / (60 * 60_000))} jam lalu`;
  const days = Math.floor(diff / (24 * 60 * 60_000));
  if (days < 7) return `${days} hari lalu`;
  return lastSeenAt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminUsersPage() {
  const session = await ensureAdminUserAccess();
  const currentUserId = session.user?.id;
  if (!currentUserId) {
    redirect("/login");
  }
  await ensureCustomRolesSeeded();

  const [rawUsers, roles] = await Promise.all([
    prisma.user.findMany({
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        createdAt: true,
        lastSeenAt: true,
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

  // Status online & label aktivitas dihitung di server agar HTML awal dan
  // hidrasi client konsisten (tanpa Date.now() di render client).
  const nowMs = new Date().getTime();
  const users = rawUsers.map(({ lastSeenAt, ...u }) => ({
    ...u,
    online:
      lastSeenAt != null && nowMs - lastSeenAt.getTime() <= ONLINE_THRESHOLD_MS,
    lastSeenLabel: lastSeenLabel(lastSeenAt, nowMs),
  }));

  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});
  const onlineCount = users.filter((u) => u.online).length;

  return (
    <div className="flex w-full flex-col gap-6">
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
            {onlineCount > 0 ? (
              <PageHeroChip>
                <span className="bg-emerald-500 size-1.5 rounded-full" aria-hidden />
                <span className="text-foreground font-semibold tabular-nums">
                  {onlineCount}
                </span>
                online
              </PageHeroChip>
            ) : null}
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
