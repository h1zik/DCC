"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { toast } from "sonner";
import {
  deleteUserByCeo,
  resetUserPasswordByCeo,
  updateUserDetailsByCeo,
} from "@/actions/users";
import { updateUserRoleByCeo } from "@/actions/user-roles";
import { effectiveRoleLabel, enumRoleLabel } from "@/lib/role-labels";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectItemDef } from "@/lib/select-option-items";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type UserAdminRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: Date;
  customRoleId: string | null;
  customRole: { id: string; name: string; isProtected: boolean } | null;
};

export type CustomRoleOption = {
  id: string;
  name: string;
  permissionTier: UserRole;
  isProtected: boolean;
};

export function AdminUsersClient({
  users,
  roles,
  currentUserId,
}: {
  users: UserAdminRow[];
  roles: CustomRoleOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<UserAdminRow | null>(null);
  const [draftEmail, setDraftEmail] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftCustomRoleId, setDraftCustomRoleId] = useState<string>("");
  const [draftPassword, setDraftPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

  const roleSelectItems = useMemo((): SelectItemDef[] => {
    return roles.map((r) => ({
      value: r.id,
      label: r.name,
    }));
  }, [roles]);

  const fallbackRoleId = useMemo(() => {
    return roles.find((r) => r.permissionTier === UserRole.LOGISTICS)?.id ?? roles[0]?.id ?? "";
  }, [roles]);

  function openEdit(row: UserAdminRow) {
    setEditing(row);
    setDraftEmail(row.email);
    setDraftName(row.name ?? "");
    setDraftCustomRoleId(row.customRoleId ?? fallbackRoleId);
    setDraftPassword("");
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditing(null);
    setDraftPassword("");
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const pwd = draftPassword.trim();
    if (pwd && pwd.length < 8) {
      toast.error("Kata sandi baru minimal 8 karakter, atau kosongkan untuk tidak mengubah.");
      return;
    }
    setPending(true);
    try {
      await updateUserDetailsByCeo({
        userId: editing.id,
        email: draftEmail,
        name: draftName,
      });

      if (
        editing.role !== UserRole.CEO &&
        draftCustomRoleId &&
        draftCustomRoleId !== editing.customRoleId
      ) {
        await updateUserRoleByCeo({
          userId: editing.id,
          customRoleId: draftCustomRoleId,
        });
      }

      if (pwd) {
        await resetUserPasswordByCeo({ userId: editing.id, password: pwd });
      }

      toast.success("Pengguna diperbarui.");
      closeEdit();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(row: UserAdminRow) {
    if (row.id === currentUserId) return;
    if (row.role === UserRole.CEO) return;
    if (!confirm(`Hapus pengguna ${row.email}? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    setDeletePendingId(row.id);
    try {
      await deleteUserByCeo({ userId: row.id });
      toast.success("Pengguna dihapus.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    } finally {
      setDeletePendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Kelola akun internal: ubah data, peran, kata sandi, atau hapus pengguna
          (kecuali akun CEO). Untuk membuat peran baru, buka{" "}
          <Link href="/admin/roles" className="text-foreground underline-offset-4 hover:underline">
            Peran (role)
          </Link>
          .
        </p>
        <Link
          href="/admin/users/new"
          className={cn(buttonVariants({ size: "sm" }), "inline-flex shrink-0 gap-2")}
        >
          <Plus className="size-4" />
          Tambah pengguna
        </Link>
      </div>

      <div className="space-y-3 md:hidden">
        {users.map((u) => (
          <div key={u.id} className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="space-y-1">
              <p className="font-mono text-xs break-all">{u.email}</p>
              <Link href={`/profile/${u.id}`} className="underline-offset-4 hover:underline">
                {u.name ?? "—"}
              </Link>
              <p className="text-muted-foreground text-xs">
                {effectiveRoleLabel(u)} ·{" "}
                {new Date(u.createdAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-8"
                aria-label={`Edit ${u.email}`}
                onClick={() => openEdit(u)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="text-destructive hover:bg-destructive/10 size-8"
                disabled={
                  u.id === currentUserId ||
                  u.role === UserRole.CEO ||
                  deletePendingId === u.id
                }
                aria-label={`Hapus ${u.email}`}
                onClick={() => void onDelete(u)}
              >
                <Trash2 className="size-3.5" />
              </Button>
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
              <th className="p-3 font-medium">Terdaftar</th>
              <th className="p-3 font-medium w-[120px]">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="p-3 font-mono text-xs">{u.email}</td>
                <td className="p-3">
                  <Link
                    href={`/profile/${u.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {u.name ?? "—"}
                  </Link>
                </td>
                <td className="p-3">{effectiveRoleLabel(u)}</td>
                <td className="text-muted-foreground p-3 text-xs">
                  {new Date(u.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="size-8"
                      aria-label={`Edit ${u.email}`}
                      onClick={() => openEdit(u)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10 size-8"
                      disabled={
                        u.id === currentUserId ||
                        u.role === UserRole.CEO ||
                        deletePendingId === u.id
                      }
                      aria-label={`Hapus ${u.email}`}
                      onClick={() => void onDelete(u)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 ? (
        <p className="text-muted-foreground text-sm">Belum ada pengguna.</p>
      ) : null}

      <Dialog open={editOpen} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent className="max-w-md" showCloseButton>
          <form onSubmit={onSaveEdit}>
            <DialogHeader>
              <DialogTitle>Edit pengguna</DialogTitle>
              <DialogDescription>
                {editing?.role === UserRole.CEO
                  ? "Peran CEO tidak dapat diubah. Anda dapat memperbarui nama, email, dan kata sandi."
                  : "Ubah data, peran, atau setel kata sandi baru (opsional)."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="eu-email">Email</Label>
                <Input
                  id="eu-email"
                  type="email"
                  required
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eu-name">Nama tampilan</Label>
                <Input
                  id="eu-name"
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={120}
                  placeholder="Opsional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eu-role">Peran</Label>
                {editing?.role === UserRole.CEO ? (
                  <Input value={enumRoleLabel(UserRole.CEO)} disabled />
                ) : (
                  <Select
                    value={draftCustomRoleId}
                    items={roleSelectItems}
                    onValueChange={(v) => v && setDraftCustomRoleId(v)}
                  >
                    <SelectTrigger id="eu-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="eu-password">Kata sandi baru (opsional)</Label>
                <Input
                  id="eu-password"
                  type="password"
                  autoComplete="new-password"
                  value={draftPassword}
                  onChange={(e) => setDraftPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak diubah"
                />
                <p className="text-muted-foreground text-[11px]">
                  Minimal 8 karakter jika diisi.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={closeEdit}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
