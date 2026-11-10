"use client";

import { useTransition } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { switchAccountMode } from "@/actions/account-modes";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { actionErrorMessage } from "@/lib/action-error-message";
import type { AccountModes } from "@/lib/account-modes";
import { tierTone } from "@/lib/role-tier-tone";
import { cn } from "@/lib/utils";

/** Ada pilihan mode hanya bila akun punya lebih dari satu peran. */
export function hasAccountModeChoice(modes: AccountModes | undefined): boolean {
  return (modes?.modes.length ?? 0) > 1;
}

/**
 * Grup "Mode akun" untuk ditaruh di dalam `DropdownMenuContent` (kartu user
 * sidebar DCC dan menu profil Lab). Tidak merender apa pun bila akun hanya
 * punya satu peran.
 *
 * Alur pindah: action menulis mode baru ke DB → `update({ refreshRole })`
 * memaksa JWT membaca ulang peran dari DB → muat ulang penuh ke beranda mode
 * itu, supaya proxy, sidebar, dan semua data server memakai peran baru.
 */
export function AccountModeMenuGroup({ modes }: { modes: AccountModes }) {
  const { update } = useSession();
  const [switching, startSwitch] = useTransition();

  if (!hasAccountModeChoice(modes)) return null;

  function choose(id: string) {
    if (id === modes.activeId || switching) return;
    startSwitch(async () => {
      try {
        const { home } = await switchAccountMode({ customRoleId: id });
        await update({ refreshRole: true });
        window.location.assign(home);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal berpindah mode."));
      }
    });
  }

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>
        {switching ? "Berpindah mode…" : "Mode akun"}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup value={modes.activeId ?? ""}>
        {modes.modes.map((mode) => (
          <DropdownMenuRadioItem
            key={mode.id}
            value={mode.id}
            disabled={switching}
            closeOnClick={false}
            onClick={() => choose(mode.id)}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                tierTone(mode.permissionTier).dot,
              )}
              aria-hidden
            />
            <span className="truncate">{mode.name}</span>
            {mode.isPrimary ? (
              <span className="text-muted-foreground shrink-0 text-[10px]">
                Utama
              </span>
            ) : null}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}
