import Link from "next/link";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCeoAdminAccess } from "@/lib/ensure-ceo-admin-access";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminAccessClient } from "./admin-access-client";

export default async function AdminAccessPage() {
  await ensureCeoAdminAccess();

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
        <Link
          href="/admin/users/new"
          className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
        >
          Tambah pengguna
        </Link>
      </div>
      <AdminAccessClient users={users} />
    </div>
  );
}
