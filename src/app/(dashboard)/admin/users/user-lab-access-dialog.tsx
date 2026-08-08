"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CapabilityEffect } from "@prisma/client";
import { Check, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { setUserCapability } from "@/actions/capabilities";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  CAPABILITIES,
  CAPABILITY_META,
  type Capability,
} from "@/lib/capabilities";
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
import { cn } from "@/lib/utils";

export type UserCapabilityOverride = {
  capability: string;
  effect: CapabilityEffect;
  expiresAt: Date | null;
  reason: string | null;
};

export type UserLabAccessTarget = {
  id: string;
  label: string;
  roleLabel: string;
  /** Kapabilitas yang diwarisi dari peran — basis sebelum override. */
  inherited: string[];
  overrides: UserCapabilityOverride[];
};

/** `null` = ikut peran (tidak ada baris override). */
type Choice = CapabilityEffect | null;

const CHOICES: { value: Choice; label: string; icon: typeof Check }[] = [
  { value: null, label: "Ikut peran", icon: Minus },
  { value: CapabilityEffect.ALLOW, label: "Beri", icon: Check },
  { value: CapabilityEffect.DENY, label: "Cabut", icon: X },
];

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function savedChoicesOf(target: UserLabAccessTarget): Record<string, Choice> {
  const map: Record<string, Choice> = {};
  for (const capability of CAPABILITIES) map[capability] = null;
  for (const o of target.overrides) map[o.capability] = o.effect;
  return map;
}

/**
 * Isi dialog. Dipisah dari pembungkusnya dan di-remount lewat `key={target.id}`
 * supaya state awalnya cukup datang dari inisialisasi `useState` — tanpa effect
 * yang menyalin props ke state di setiap pergantian target.
 */
function LabAccessForm({
  target,
  onClose,
}: {
  target: UserLabAccessTarget;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const savedChoices = useMemo(() => savedChoicesOf(target), [target]);
  const [choices, setChoices] = useState<Record<string, Choice>>(savedChoices);
  const [reason, setReason] = useState(
    () => target.overrides.find((o) => o.reason)?.reason ?? "",
  );
  const [expiresAt, setExpiresAt] = useState(() =>
    toDateInputValue(target.overrides.find((o) => o.expiresAt)?.expiresAt ?? null),
  );

  const inherited = useMemo(() => new Set(target.inherited), [target]);

  const dirty = useMemo(
    () =>
      CAPABILITIES.filter(
        (capability) => choices[capability] !== savedChoices[capability],
      ),
    [choices, savedChoices],
  );

  function effectiveFor(capability: Capability): boolean {
    const choice = choices[capability];
    if (choice === CapabilityEffect.ALLOW) return true;
    if (choice === CapabilityEffect.DENY) return false;
    return inherited.has(capability);
  }

  async function onSave() {
    if (dirty.length === 0) return;
    setPending(true);
    try {
      for (const capability of dirty) {
        await setUserCapability({
          userId: target.id,
          capability,
          effect: choices[capability] ?? null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          reason: reason.trim() || null,
        });
      }
      toast.success("Akses Lab diperbarui.");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal menyimpan akses."));
    } finally {
      setPending(false);
    }
  }

  const hasOverride = dirty.some((c) => choices[c] !== null);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Akses Dominatus Lab</DialogTitle>
        <DialogDescription>
          Pengecualian untuk <b>{target.label}</b>. Basisnya peran{" "}
          <b>{target.roleLabel}</b> — ubah di sini hanya bila orang ini perlu
          berbeda dari perannya.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2 py-1">
        {CAPABILITIES.map((capability) => {
          const choice = choices[capability] ?? null;
          const fromRole = inherited.has(capability);
          const open = effectiveFor(capability);
          return (
            <div
              key={capability}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {CAPABILITY_META[capability].label}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {fromRole ? "Diwarisi dari peran" : "Tidak ada di peran"} ·
                  hasil:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      open
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {open ? "terbuka" : "terkunci"}
                  </span>
                </p>
              </div>
              <div
                className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
                role="group"
                aria-label={`Akses ${CAPABILITY_META[capability].label}`}
              >
                {CHOICES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={pending}
                    aria-pressed={choice === value}
                    onClick={() =>
                      setChoices((prev) => ({ ...prev, [capability]: value }))
                    }
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
                      choice === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {hasOverride ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cap-reason">Alasan</Label>
            <Input
              id="cap-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mis. bantu audit SEO Q3"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cap-expires">Berlaku sampai (opsional)</Label>
            <Input
              id="cap-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <p className="text-muted-foreground text-[11px] sm:col-span-2">
            Diterapkan ke semua pengecualian yang kamu ubah kali ini. Setelah
            tanggalnya lewat, akses kembali mengikuti peran dengan sendirinya.
          </p>
        </div>
      ) : null}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          Tutup
        </Button>
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={pending || dirty.length === 0}
        >
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Pengecualian akses Lab untuk satu orang.
 *
 * Tiga pilihan per modul — ikut peran, beri, cabut — karena "tidak dicentang"
 * saja tidak cukup: mencabut sesuatu yang diwarisi peran adalah keputusan
 * berbeda dari sekadar tidak menambahkannya, dan keduanya perlu terlihat.
 */
export function UserLabAccessDialog({
  target,
  onClose,
}: {
  target: UserLabAccessTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" showCloseButton>
        {target ? (
          <LabAccessForm key={target.id} target={target} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
