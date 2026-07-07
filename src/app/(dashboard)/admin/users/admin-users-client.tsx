"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useMemo, useState } from "react";
import Image from "next/image";
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
import { tierTone } from "@/lib/role-tier-tone";
import { hub } from "@/components/brand-hub/brand-hub-primitives";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Lock, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type UserAdminRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  createdAt: Date;
  customRoleId: string | null;
  customRole: { id: string; name: string; isProtected: boolean } | null;
  online: boolean;
  lastSeenLabel: string;
};

export type CustomRoleOption = {
  id: string;
  name: string;
  permissionTier: UserRole;
  isProtected: boolean;
};

function personLabel(u: { name: string | null; email: string }): string {
  return u.name?.trim() || u.email;
}

function initialsOf(label: string): string {
  const parts = label.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function UserAvatar({
  user,
  size = 36,
  showOnline = true,
}: {
  user: Pick<UserAdminRow, "name" | "email" | "image" | "online">;
  size?: number;
  showOnline?: boolean;
}) {
  const label = personLabel(user);
  return (
    <div className="relative shrink-0" title={label}>
      {user.image ? (
        <Image
          src={user.image}
          alt={label}
          width={size}
          height={size}
          unoptimized
          className="rounded-full border border-border object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="bg-muted text-muted-foreground flex items-center justify-center rounded-full border border-border text-[11px] font-semibold"
          style={{ width: size, height: size }}
          aria-hidden
        >
          {initialsOf(label)}
        </div>
      )}
      {showOnline && user.online ? (
        <span
          className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-background bg-emerald-500"
          title="Online sekarang"
        />
      ) : null}
    </div>
  );
}

function RoleBadge({ user }: { user: UserAdminRow }) {
  const tone = tierTone(user.role);
  const label = effectiveRoleLabel(user);
  const locked = user.role === UserRole.CEO || user.customRole?.isProtected;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone.chip,
      )}
      title={`Tier permission: ${enumRoleLabel(user.role)}`}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} aria-hidden />
      <span className="truncate">{label}</span>
      {locked ? <Lock className="size-2.5 shrink-0" aria-hidden /> : null}
    </span>
  );
}

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
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
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

  /** Chip filter per peran (label efektif) berikut jumlah penggunanya. */
  const roleChips = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of users) {
      const label = effectiveRoleLabel(u);
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"))
      .map(([label, count]) => ({ label, count }));
  }, [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && effectiveRoleLabel(u) !== roleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter]);

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
      toast.error(actionErrorMessage(err, "Gagal menyimpan."));
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
      toast.error(actionErrorMessage(err, "Gagal menghapus."));
    } finally {
      setDeletePendingId(null);
    }
  }

  function rowActions(u: UserAdminRow) {
    return (
      <div className="flex shrink-0 items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8"
          aria-label={`Edit ${u.email}`}
          title="Edit pengguna"
          onClick={() => openEdit(u)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:bg-destructive/10 size-8 disabled:text-muted-foreground disabled:hover:bg-transparent"
          disabled={
            u.id === currentUserId ||
            u.role === UserRole.CEO ||
            deletePendingId === u.id
          }
          aria-label={`Hapus ${u.email}`}
          title={
            u.id === currentUserId
              ? "Tidak bisa menghapus akun sendiri"
              : u.role === UserRole.CEO
                ? "Akun CEO tidak dapat dihapus"
                : "Hapus pengguna"
          }
          onClick={() => void onDelete(u)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    );
  }

  function identityCell(u: UserAdminRow) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar user={u} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/profile/${u.id}`}
              className="truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              {u.name?.trim() || "Tanpa nama"}
            </Link>
            {u.id === currentUserId ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                Kamu
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground truncate font-mono text-xs">
            {u.email}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: cari, filter peran, tambah pengguna */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau email…"
              className="pl-9"
              aria-label="Cari pengguna"
            />
          </div>
          <Link
            href="/admin/users/new"
            className={cn(buttonVariants({ size: "sm" }), "inline-flex shrink-0 gap-2")}
          >
            <Plus className="size-4" />
            Tambah pengguna
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRoleFilter("all")}
            aria-pressed={roleFilter === "all"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              roleFilter === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Semua
            <span className="tabular-nums opacity-70">{users.length}</span>
          </button>
          {roleChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() =>
                setRoleFilter((prev) => (prev === chip.label ? "all" : chip.label))
              }
              aria-pressed={roleFilter === chip.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                roleFilter === chip.label
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {chip.label}
              <span className="tabular-nums opacity-70">{chip.count}</span>
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Untuk membuat peran baru, buka{" "}
          <Link
            href="/admin/roles"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Peran (role)
          </Link>
          .
        </p>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada pengguna"
          description="Tambahkan akun internal pertama untuk tim kamu."
          action={
            <Link href="/admin/users/new" className={cn(buttonVariants({ size: "sm" }))}>
              <Plus className="size-4" />
              Tambah pengguna
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Tidak ada pengguna yang cocok"
          description="Coba ubah kata kunci atau filter peran."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery("");
                setRoleFilter("all");
              }}
            >
              <X className="size-4" />
              Bersihkan filter
            </Button>
          }
        />
      ) : (
        <>
          {/* Mobile: kartu per pengguna */}
          <div className={cn("space-y-3 md:hidden", hub.entrance)}>
            {filtered.map((u) => (
              <div
                key={u.id}
                className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  {identityCell(u)}
                  {rowActions(u)}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/50 pt-2.5">
                  <RoleBadge user={u} />
                  <span className="text-muted-foreground text-xs">
                    {u.online ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300">
                        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                        Online
                      </span>
                    ) : (
                      u.lastSeenLabel
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Terdaftar{" "}
                    {new Date(u.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: tabel */}
          <div
            className={cn(
              "hidden overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:block",
              hub.entrance,
            )}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-3">Pengguna</th>
                  <th className="px-4 py-3">Peran</th>
                  <th className="px-4 py-3">Aktivitas</th>
                  <th className="px-4 py-3">Terdaftar</th>
                  <th className="w-[110px] px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">{identityCell(u)}</td>
                    <td className="px-4 py-3">
                      <RoleBadge user={u} />
                    </td>
                    <td className="px-4 py-3">
                      {u.online ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                          Online sekarang
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {u.lastSeenLabel}
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {new Date(u.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">{rowActions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {query.trim() || roleFilter !== "all" ? (
            <p className="text-muted-foreground -mt-1 text-xs">
              Menampilkan{" "}
              <span className="text-foreground font-medium tabular-nums">
                {filtered.length}
              </span>{" "}
              dari {users.length} pengguna
            </p>
          ) : null}
        </>
      )}

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
            {editing ? (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-3">
                <UserAvatar user={editing} size={40} showOnline={false} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {personLabel(editing)}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <RoleBadge user={editing} />
                  </div>
                </div>
              </div>
            ) : null}
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
