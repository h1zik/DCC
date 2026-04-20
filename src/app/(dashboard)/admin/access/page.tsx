import Link from "next/link";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureAdminUserAccess } from "@/lib/ensure-ceo-admin-access";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminAccessClient } from "./admin-access-client";

export default async function AdminAccessPage() {
  await ensureAdminUserAccess();

  const users = await prisma.user.findMany({
    where: { role: { not: UserRole.CEO } },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hak akses administrator
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tetapkan siapa yang mengelola master brand dan ruang kerja tim.
            Peran lain juga dapat disesuaikan di sini.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/admin/users"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Semua pengguna
          </Link>
          <Link
            href="/admin/users/new"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Tambah pengguna
          </Link>
        </div>
      </div>
      <AdminAccessClient users={users} />
    </div>
  );
}
