import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureAdminUserAccess } from "@/lib/ensure-ceo-admin-access";
import { AdminUsersClient } from "./admin-users-client";

export default async function AdminUsersPage() {
  const session = await ensureAdminUserAccess();
  const currentUserId = session.user?.id;
  if (!currentUserId) {
    redirect("/login");
  }

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pengguna</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Kelola akun internal dan peran pengguna langsung dari daftar ini.
        </p>
      </div>
      <AdminUsersClient users={users} currentUserId={currentUserId} />
    </div>
  );
}
