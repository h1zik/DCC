import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ensureAdminUserAccess } from "@/lib/ensure-ceo-admin-access";
import { ensureCustomRolesSeeded } from "@/lib/custom-roles";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AdminAddUserClient } from "./admin-add-user-client";

export default async function AdminAddUserPage() {
  await ensureAdminUserAccess();
  await ensureCustomRolesSeeded();
  const roles = await prisma.customRole.findMany({
    where: { permissionTier: { not: UserRole.CEO } },
    orderBy: [{ isProtected: "desc" }, { name: "asc" }],
    select: { id: true, name: true, permissionTier: true, isProtected: true },
  });

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tambah pengguna
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Buat akun internal baru beserta peran. Peran CEO tidak dapat dibuat
          dari sini.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data pengguna</CardTitle>
          <CardDescription>
            Email harus unik di sistem. Setelah dibuat, atur ulang peran jika
            perlu di menu{" "}
            <Link
              href="/admin/users"
              className="text-accent-foreground font-medium underline-offset-2 hover:underline"
            >
              Daftar pengguna
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminAddUserClient roles={roles} />
        </CardContent>
      </Card>
      <Link
        href="/admin/users"
        className={cn(buttonVariants({ variant: "ghost" }), "w-fit text-sm")}
      >
        ← Kembali ke pengguna
      </Link>
    </div>
  );
}
