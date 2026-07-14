"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ArrowLeft, LogOut } from "lucide-react";
import type { UserRole } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { effectiveRoleLabel } from "@/lib/role-labels";

export type LabUser = {
  name: string | null;
  image: string | null;
  role: UserRole;
  customRoleName: string | null;
};

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Menu profil di header Lab: identitas, kembali ke DCC, keluar. */
export function LabUserMenu({ user }: { user: LabUser }) {
  const roleLabel = effectiveRoleLabel({
    role: user.role,
    customRole: user.customRoleName ? { name: user.customRoleName } : null,
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Menu profil"
            className="inline-flex size-9 items-center justify-center overflow-hidden rounded-full border border-border bg-card/60 text-xs font-bold text-foreground backdrop-blur-md transition-colors hover:border-primary/40"
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar kecil, sumber upload internal
              <img
                src={user.image}
                alt={user.name ?? "Avatar"}
                className="size-full object-cover"
              />
            ) : (
              initials(user.name)
            )}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-semibold">
            {user.name ?? "Pengguna"}
          </span>
          <span className="text-muted-foreground block truncate text-xs font-normal">
            {roleLabel}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/home" />}>
          <ArrowLeft />
          Kembali ke DCC
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => void signOut({ callbackUrl: "/login" })}
        >
          <LogOut />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
