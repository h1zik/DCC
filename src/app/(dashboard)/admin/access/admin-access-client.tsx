"use client";

import { useMemo, useState } from "react";
import { UserRole, type User } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateUserRoleByCeo } from "@/actions/user-roles";
import {
  CEO_ASSIGNABLE_USER_ROLES,
  ceoAssignableRoleLabel,
} from "@/lib/ceo-assignable-roles";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectItemDef } from "@/lib/select-option-items";

export type AdminAccessRow = Pick<User, "id" | "email" | "name" | "role">;

export function AdminAccessClient({
  users,
  hideBackButton = false,
}: {
  users: AdminAccessRow[];
  hideBackButton?: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const ceoRoleSelectItems = useMemo((): SelectItemDef[] => {
    return CEO_ASSIGNABLE_USER_ROLES.map((r) => ({
      value: r,
      label: ceoAssignableRoleLabel(r),
    }));
  }, []);

  async function onRoleChange(userId: string, role: UserRole) {
    setPendingId(userId);
    try {
      await updateUserRoleByCeo({ userId, role });
      toast.success("Peran diperbarui.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Hanya Administrator yang dapat menetapkan atau mencabut peran{" "}
        <span className="text-foreground font-medium">Administrator</span>{" "}
        (akses menu Brand dan Ruang kerja). Pengguna yang sedang masuk harus
        keluar lalu masuk lagi agar menu sesuai peran baru.
      </p>
      <div className="space-y-3 md:hidden">
        {users.map((u) => (
          <div key={u.id} className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="space-y-2">
              <p className="font-mono text-xs break-all">{u.email}</p>
              <p>{u.name ?? "—"}</p>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor={`role-mobile-${u.id}`}>
                  Peran
                </Label>
                <Select
                  value={u.role}
                  items={ceoRoleSelectItems}
                  disabled={pendingId === u.id}
                  onValueChange={(v) => {
                    if (!v) return;
                    void onRoleChange(u.id, v as UserRole);
                  }}
                >
                  <SelectTrigger id={`role-mobile-${u.id}`} className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CEO_ASSIGNABLE_USER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ceoAssignableRoleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden rounded-lg border border-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Nama</th>
              <th className="p-3 font-medium">Peran</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="p-3 font-mono text-xs">{u.email}</td>
                <td className="p-3">{u.name ?? "—"}</td>
                <td className="p-3">
                  <div className="flex max-w-xs flex-col gap-1">
                    <Label className="sr-only" htmlFor={`role-${u.id}`}>
                      Peran untuk {u.email}
                    </Label>
                    <Select
                      value={u.role}
                      items={ceoRoleSelectItems}
                      disabled={pendingId === u.id}
                      onValueChange={(v) => {
                        if (!v) return;
                        void onRoleChange(u.id, v as UserRole);
                      }}
                    >
                      <SelectTrigger id={`role-${u.id}`} className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                    {CEO_ASSIGNABLE_USER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ceoAssignableRoleLabel(r)}
                      </SelectItem>
                    ))}
                      </SelectContent>
                    </Select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 ? (
        <p className="text-muted-foreground text-sm">Tidak ada pengguna.</p>
      ) : null}
      {!hideBackButton ? (
        <Button type="button" variant="outline" onClick={() => router.push("/")}>
          Kembali ke dashboard
        </Button>
      ) : null}
    </div>
  );
}
