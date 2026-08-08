"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { FlaskConical, Info, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { updateRoleCapabilities } from "@/actions/capabilities";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  CAPABILITIES,
  CAPABILITY_META,
  type Capability,
} from "@/lib/capabilities";
import { enumRoleLabel } from "@/lib/role-labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type LabAccessMatrixRole = {
  id: string;
  name: string;
  permissionTier: UserRole;
  isProtected: boolean;
  capabilities: string[];
  _count: { users: number };
};

/** Kunci stabil untuk membandingkan dua himpunan kapabilitas. */
function fingerprint(capabilities: Iterable<string>): string {
  return [...capabilities].sort().join("|");
}

/**
 * Matriks peran × modul Dominatus Lab.
 *
 * Inilah yang membuat peran kustom benar-benar berarti: "SEO Specialist" bisa
 * memakai tier `NORMAL_USER` tapi hanya memegang SEO Toolkit, tanpa harus
 * dinaikkan jadi Market Analyst dan ikut kebagian Research Hub.
 */
export function LabAccessMatrix({
  roles,
}: {
  roles: LabAccessMatrixRole[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(roles.map((r) => [r.id, new Set(r.capabilities)])),
  );

  // Peran ber-tier CEO tidak dikelola di sini (dijaga juga di server action).
  const editable = useMemo(
    () => roles.filter((r) => r.permissionTier !== UserRole.CEO),
    [roles],
  );

  const dirtyIds = useMemo(() => {
    const saved = new Map(roles.map((r) => [r.id, fingerprint(r.capabilities)]));
    return editable
      .filter((r) => fingerprint(draft[r.id] ?? []) !== saved.get(r.id))
      .map((r) => r.id);
  }, [draft, editable, roles]);

  function toggle(roleId: string, capability: Capability, next: boolean) {
    setDraft((prev) => {
      const current = new Set(prev[roleId] ?? []);
      if (next) current.add(capability);
      else current.delete(capability);
      return { ...prev, [roleId]: current };
    });
  }

  function reset() {
    setDraft(
      Object.fromEntries(roles.map((r) => [r.id, new Set(r.capabilities)])),
    );
  }

  async function onSave() {
    if (dirtyIds.length === 0) return;
    setPending(true);
    try {
      for (const roleId of dirtyIds) {
        await updateRoleCapabilities({
          roleId,
          capabilities: [...(draft[roleId] ?? [])] as Capability[],
        });
      }
      toast.success(
        dirtyIds.length === 1
          ? "Akses peran diperbarui."
          : `Akses ${dirtyIds.length} peran diperbarui.`,
      );
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal menyimpan akses."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-lg bg-muted/60 p-1.5 text-muted-foreground ring-1 ring-border/60"
          aria-hidden
        >
          <FlaskConical className="size-4" />
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Akses Dominatus Lab
        </h2>
        <span className="text-muted-foreground text-xs">
          · centang modul yang boleh dibuka tiap peran
        </span>
        <div className="ml-auto flex items-center gap-2">
          {dirtyIds.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={pending}
            >
              <RotateCcw className="size-3.5" />
              Batalkan
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={() => void onSave()}
            disabled={pending || dirtyIds.length === 0}
          >
            {pending
              ? "Menyimpan…"
              : dirtyIds.length > 0
                ? `Simpan perubahan (${dirtyIds.length})`
                : "Simpan perubahan"}
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">
        Akses Lab lepas dari tier permission — sebuah peran ber-tier Normal User
        bisa saja memegang SEO Toolkit saja. Memegang minimal satu modul otomatis
        membuka beranda Lab, jadi kolom “Beranda Lab” hanya perlu dicentang bila
        seseorang harus bisa melihat launcher tanpa modul apa pun. Untuk
        pengecualian satu orang, pakai override di halaman Pengguna.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[190px]">Peran</TableHead>
              {CAPABILITIES.map((capability) => (
                <TableHead key={capability} className="text-center">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex items-center gap-1">
                          {CAPABILITY_META[capability].label}
                          <Info
                            className="size-3 text-muted-foreground"
                            aria-hidden
                          />
                        </span>
                      }
                    />
                    <TooltipContent className="max-w-xs">
                      {CAPABILITY_META[capability].description}
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {editable.map((role) => {
              const selected = draft[role.id] ?? new Set<string>();
              const dirty = dirtyIds.includes(role.id);
              return (
                <TableRow
                  key={role.id}
                  className={cn(dirty && "bg-primary/[0.04]")}
                >
                  <TableCell className="align-middle">
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                        {role.name}
                        {role.isProtected ? (
                          <Lock
                            className="size-3 shrink-0 text-muted-foreground"
                            aria-label="Peran inti"
                          />
                        ) : null}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        Tier {enumRoleLabel(role.permissionTier)} ·{" "}
                        {role._count.users} pengguna
                      </span>
                    </div>
                  </TableCell>
                  {CAPABILITIES.map((capability) => (
                    <TableCell key={capability} className="text-center">
                      <Checkbox
                        className="mx-auto"
                        checked={selected.has(capability)}
                        disabled={pending}
                        aria-label={`${CAPABILITY_META[capability].label} untuk ${role.name}`}
                        onCheckedChange={(next) =>
                          toggle(role.id, capability, next === true)
                        }
                      />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
