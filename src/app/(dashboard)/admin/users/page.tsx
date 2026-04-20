import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureAdminUserAccess } from "@/lib/ensure-ceo-admin-access";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pengguna</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Buat, ubah, atau hapus akun internal. Penetapan peran administrator
            juga tersedia di menu Hak akses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/users/new"
            className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
          >
            Tambah pengguna
          </Link>
          <Link
            href="/admin/access"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
          >
            Hak akses
          </Link>
        </div>
      </div>
      <AdminUsersClient users={users} currentUserId={currentUserId} />
    </div>
  );
}
