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
  enumRoleLabel,
  permissionTierLabel,
} from "@/lib/role-labels";
import { tierDescription, tierTone } from "@/lib/role-tier-tone";
import { hub } from "@/components/brand-hub/brand-hub-primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
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
import {
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminRoleRow = {
  id: string;
  name: string;
  slug: string;
  permissionTier: UserRole;
  isProtected: boolean;
  _count: { users: number };
};

function SectionHeader({
  icon: Icon,
  title,
  count,
  hint,
}: {
  icon: typeof ShieldCheck;
  title: string;
  count: number;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="rounded-lg bg-muted/60 p-1.5 text-muted-foreground ring-1 ring-border/60"
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
        {count}
      </span>
      {hint ? (
        <span className="text-muted-foreground text-xs">· {hint}</span>
      ) : null}
    </div>
  );
}

function RoleCard({
  role,
  index,
  totalUsers,
  pending,
  onEdit,
  onDelete,
}: {
  role: AdminRoleRow;
  index: number;
  totalUsers: number;
  pending: boolean;
  onEdit: (r: AdminRoleRow) => void;
  onDelete: (r: AdminRoleRow) => void;
}) {
  const tone = tierTone(role.permissionTier);
  const pct =
    totalUsers > 0 ? Math.round((role._count.users / totalUsers) * 100) : 0;
  const barWidth = role._count.users > 0 ? Math.max(pct, 6) : 0;

  return (
    <article
      className={cn(
        hub.card,
        hub.cardHover,
        hub.entrance,
        "group flex flex-col gap-3 p-4 fill-mode-both",
        role.isProtected && "border-primary/20",
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
    >
      {role.isProtected ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
          aria-hidden
        />
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            role.isProtected ? "bg-primary/10 text-primary" : tone.iconTile,
          )}
          aria-hidden
        >
          {role.isProtected ? (
            <ShieldCheck className="size-5" />
          ) : (
            <Sparkles className="size-5" />
          )}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${role.name}`}
            title="Edit peran"
            onClick={() => onEdit(role)}
          >
            <Pencil className="size-3.5" />
          </Button>
          {!role.isProtected ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Hapus ${role.name}`}
              title={
                role._count.users > 0
                  ? "Pindahkan dulu pengguna sebelum menghapus"
                  : "Hapus peran"
              }
              disabled={role._count.users > 0 || pending}
              className="text-destructive hover:bg-destructive/10 disabled:text-muted-foreground disabled:hover:bg-transparent"
              onClick={() => onDelete(role)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
            {role.name}
          </h3>
          {role.isProtected ? (
            <span className="border-border bg-muted/60 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
              <Lock className="size-2.5" aria-hidden /> Inti
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            tone.chip,
          )}
        >
          <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
          Tier {enumRoleLabel(role.permissionTier)}
        </span>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {tierDescription(role.permissionTier)}
        </p>
      </div>

      <div className="mt-auto space-y-1.5 border-t border-border/50 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Users className="size-3" aria-hidden />
            Pengguna
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {role._count.users}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="presentation"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              role.isProtected ? "bg-primary/70" : tone.bar,
            )}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </article>
  );
}

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

  const protectedRoles = roles.filter((r) => r.isProtected);
  const customRoles = roles.filter((r) => !r.isProtected);
  const totalUsers = roles.reduce((acc, r) => acc + r._count.users, 0);

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground max-w-2xl text-sm">
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

      <section className="flex flex-col gap-3">
        <SectionHeader
          icon={ShieldCheck}
          title="Peran inti"
          count={protectedRoles.length}
          hint="dikunci sistem, hanya bisa ganti nama"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {protectedRoles.map((r, i) => (
            <RoleCard
              key={r.id}
              role={r}
              index={i}
              totalUsers={totalUsers}
              pending={pending}
              onEdit={openEdit}
              onDelete={(row) => void onDelete(row)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          icon={Sparkles}
          title="Peran kustom"
          count={customRoles.length}
          hint="bebas dibuat, diubah, dan dihapus"
        />
        {customRoles.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {customRoles.map((r, i) => (
              <RoleCard
                key={r.id}
                role={r}
                index={protectedRoles.length + i}
                totalUsers={totalUsers}
                pending={pending}
                onEdit={openEdit}
                onDelete={(row) => void onDelete(row)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Belum ada peran kustom"
            description="Buat peran sesuai struktur tim — mis. DevOps Engineer dengan tier Logistik."
            action={
              <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Tambah peran
              </Button>
            }
          />
        )}
      </section>

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
