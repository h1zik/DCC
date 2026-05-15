"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { toast } from "sonner";
import {
  createCustomRole,
  deleteCustomRole,
  renameCustomRole,
  updateCustomRoleTier,
} from "@/actions/custom-roles";
import {
  ASSIGNABLE_PERMISSION_TIERS,
  permissionTierLabel,
} from "@/lib/role-labels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Lock, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminRoleRow = {
  id: string;
  name: string;
  slug: string;
  permissionTier: UserRole;
  isProtected: boolean;
  _count: { users: number };
};

export function AdminRolesClient({ roles }: { roles: AdminRoleRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createTier, setCreateTier] = useState<UserRole>(UserRole.LOGISTICS);
  const [editing, setEditing] = useState<AdminRoleRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editTier, setEditTier] = useState<UserRole>(UserRole.LOGISTICS);

  const tierItems = useMemo(
    (): SelectItemDef[] =>
      ASSIGNABLE_PERMISSION_TIERS.map((t) => ({
        value: t,
        label: permissionTierLabel(t),
      })),
    [],
  );

  function openEdit(row: AdminRoleRow) {
    setEditing(row);
    setEditName(row.name);
    setEditTier(row.permissionTier);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (name.length < 2) {
      toast.error("Nama peran minimal 2 karakter.");
      return;
    }
    setPending(true);
    try {
      await createCustomRole({ name, permissionTier: createTier });
      toast.success(`Peran "${name}" dibuat.`);
      setCreateOpen(false);
      setCreateName("");
      setCreateTier(UserRole.LOGISTICS);
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal membuat peran."));
    } finally {
      setPending(false);
    }
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const name = editName.trim();
    if (name.length < 2) {
      toast.error("Nama peran minimal 2 karakter.");
      return;
    }
    setPending(true);
    try {
      if (name !== editing.name) {
        await renameCustomRole({ id: editing.id, name });
      }
      if (!editing.isProtected && editTier !== editing.permissionTier) {
        await updateCustomRoleTier({
          id: editing.id,
          permissionTier: editTier,
        });
      }
      toast.success("Peran diperbarui.");
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal menyimpan."));
    } finally {
      setPending(false);
    }
  }

  async function onDelete(row: AdminRoleRow) {
    if (row.isProtected) return;
    if (row._count.users > 0) {
      toast.error(
        `"${row.name}" masih dipakai ${row._count.users} pengguna. Pindahkan dulu mereka ke peran lain.`,
      );
      return;
    }
    if (!confirm(`Hapus peran "${row.name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    setPending(true);
    try {
      await deleteCustomRole({ id: row.id });
      toast.success("Peran dihapus.");
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal menghapus."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Buat, ganti nama, atau hapus peran sesuai kebutuhan tim. Tier
          permission menentukan modul/halaman apa yang dapat diakses oleh user
          dengan peran tersebut.
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="shrink-0"
        >
          <Plus className="size-4" />
          Tambah peran
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {roles.map((r) => (
          <li
            key={r.id}
            className={cn(
              "border-border bg-card flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:gap-4",
              r.isProtected && "ring-1 ring-primary/15",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                r.isProtected
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {r.isProtected ? (
                <ShieldCheck className="size-4" />
              ) : (
                <Pencil className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-foreground truncate text-sm font-semibold">
                  {r.name}
                </span>
                {r.isProtected ? (
                  <span className="border-border bg-muted/60 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                    <Lock className="size-2.5" /> Inti
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Tier permission:{" "}
                <span className="text-foreground font-medium">
                  {permissionTierLabel(r.permissionTier)}
                </span>
              </p>
            </div>
            <div className="text-muted-foreground inline-flex shrink-0 items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[11px] tabular-nums">
              <Users className="size-3" aria-hidden />
              {r._count.users}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Edit ${r.name}`}
                title="Edit peran"
                onClick={() => openEdit(r)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Hapus ${r.name}`}
                title={
                  r.isProtected
                    ? "Peran inti tidak dapat dihapus"
                    : r._count.users > 0
                      ? "Pindahkan dulu pengguna sebelum menghapus"
                      : "Hapus peran"
                }
                disabled={r.isProtected || r._count.users > 0 || pending}
                className="text-destructive hover:bg-destructive/10 disabled:hover:bg-transparent disabled:text-muted-foreground"
                onClick={() => void onDelete(r)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md" showCloseButton>
          <form onSubmit={onCreate}>
            <DialogHeader>
              <DialogTitle>Tambah peran baru</DialogTitle>
              <DialogDescription>
                Beri nama peran lalu pilih tier permission (akses modul) yang
                dipakai sistem untuk peran ini.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="cr-name">Nama peran</Label>
                <Input
                  id="cr-name"
                  placeholder="Mis. DevOps Engineer"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  maxLength={80}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-tier">Tier permission</Label>
                <Select
                  value={createTier}
                  items={tierItems}
                  onValueChange={(v) => v && setCreateTier(v as UserRole)}
                >
                  <SelectTrigger id="cr-tier" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_PERMISSION_TIERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {permissionTierLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-[11px]">
                  Tier menentukan akses sistem (mis. modul Finance hanya bisa
                  dibuka oleh peran ber-tier Finance).
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Buat peran"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md" showCloseButton>
          <form onSubmit={onSaveEdit}>
            <DialogHeader>
              <DialogTitle>Edit peran</DialogTitle>
              <DialogDescription>
                {editing?.isProtected
                  ? "Peran inti — kamu hanya bisa mengganti namanya. Tier permission tidak dapat diubah."
                  : "Ganti nama atau tier permission peran."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="er-name">Nama peran</Label>
                <Input
                  id="er-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="er-tier">Tier permission</Label>
                <Select
                  value={editTier}
                  items={tierItems}
                  disabled={editing?.isProtected}
                  onValueChange={(v) => v && setEditTier(v as UserRole)}
                >
                  <SelectTrigger id="er-tier" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_PERMISSION_TIERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {permissionTierLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editing?.isProtected ? (
                  <p className="text-muted-foreground text-[11px]">
                    Tier peran inti dikunci sistem demi keamanan akses.
                  </p>
                ) : null}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
