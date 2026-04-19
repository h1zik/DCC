"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { toast } from "sonner";
import { createUserByCeo } from "@/actions/users";
import {
  CEO_ASSIGNABLE_USER_ROLES,
  ceoAssignableRoleLabel,
} from "@/lib/ceo-assignable-roles";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SelectItemDef } from "@/lib/select-option-items";

export function AdminAddUserClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.LOGISTICS);
  const [pending, setPending] = useState(false);

  const ceoRoleSelectItems = useMemo((): SelectItemDef[] => {
    return CEO_ASSIGNABLE_USER_ROLES.map((r) => ({
      value: r,
      label: ceoAssignableRoleLabel(r),
    }));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setPending(true);
    try {
      await createUserByCeo({
        email,
        name: name.trim() || undefined,
        password,
        role,
      });
      toast.success("Pengguna berhasil dibuat. Sampaikan kredensial dengan saluran aman.");
      setEmail("");
      setName("");
      setPassword("");
      setConfirm("");
      router.refresh();
      router.push("/admin/users");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat pengguna.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="space-y-2">
        <Label htmlFor="nu-email">Email</Label>
        <Input
          id="nu-email"
          type="email"
          autoComplete="off"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@perusahaan.co.id"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nu-name">Nama tampilan (opsional)</Label>
        <Input
          id="nu-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama lengkap"
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nu-role">Peran awal</Label>
        <Select
          value={role}
          items={ceoRoleSelectItems}
          onValueChange={(v) => {
            if (v) setRole(v as UserRole);
          }}
        >
          <SelectTrigger id="nu-role" className="w-full">
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
      <div className="space-y-2">
        <Label htmlFor="nu-password">Kata sandi awal</Label>
        <Input
          id="nu-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimal 8 karakter"
          minLength={8}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nu-confirm">Ulangi kata sandi</Label>
        <Input
          id="nu-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Sama seperti di atas"
          minLength={8}
        />
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Pengguna dapat mengganti kata sandi setelah masuk (jika fitur profil
        diaktifkan). Beritahu mereka email dan sandi awal secara pribadi.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Buat pengguna"}
        </Button>
        <Link
          href="/admin/users"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Batal — kembali ke daftar pengguna
        </Link>
      </div>
    </form>
  );
}
