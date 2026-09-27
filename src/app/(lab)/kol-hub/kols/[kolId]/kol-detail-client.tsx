"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, CalendarPlus, Clock3, Pencil, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  cancelKolChangeRequest,
  deleteKolProfile,
  requestKolStatusChange,
  runKolAccountAudit,
} from "@/actions/kol-profiles";
import { ReasonDialog } from "@/components/kol-hub/reason-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/action-error-message";
import { formatWibDateTime } from "@/lib/kol/time";
import { cn } from "@/lib/utils";

export function KolDetailActions({
  kolId,
  status,
  hasPending,
  hasSchedules,
}: {
  kolId: string;
  status: string;
  hasPending: boolean;
  hasSchedules: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const blacklisting = status === "ACTIVE";
  const canToggleBlacklist = (status === "ACTIVE" || status === "BLACKLISTED") && !hasPending;
  const canDelete = !hasSchedules && (status === "WAITING_APPROVAL" || status === "REJECTED");

  return (
    <>
      {status === "ACTIVE" ? (
        <Button size="sm" render={<Link href={`/kol-hub/schedules/new?kol=${kolId}`} />}>
          <CalendarPlus />
          Buat jadwal
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        disabled={hasPending && status !== "WAITING_APPROVAL"}
        render={<Link href={`/kol-hub/kols/${kolId}/edit`} />}
      >
        <Pencil />
        Ubah
      </Button>
      {canToggleBlacklist ? (
        <Button
          size="sm"
          variant={blacklisting ? "ghost" : "outline"}
          onClick={() => setReasonOpen(true)}
        >
          {blacklisting ? <Ban /> : <ShieldCheck />}
          {blacklisting ? "Ajukan blacklist" : "Ajukan buka blacklist"}
        </Button>
      ) : null}
      {canDelete ? (
        <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)} aria-label="Hapus KOL">
          <Trash2 />
        </Button>
      ) : null}

      <ReasonDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        title={blacklisting ? "Ajukan blacklist" : "Ajukan buka blacklist"}
        description={
          blacklisting
            ? "KOL yang di-blacklist tidak bisa dijadwalkan lagi. Pengajuan ini diputus approver."
            : "Setelah disetujui, KOL bisa dijadwalkan kembali."
        }
        placeholder={blacklisting ? "Mis. tidak posting sesuai brief dua kali" : "Mis. sudah ada kesepakatan baru"}
        confirmLabel="Ajukan"
        destructive={blacklisting}
        pending={pending}
        onConfirm={(reason) =>
          startTransition(async () => {
            try {
              await requestKolStatusChange({
                kolId,
                reason,
                type: blacklisting ? "BLACKLIST" : "UNBLACKLIST",
              });
              toast.success("Pengajuan dikirim ke approver.");
              setReasonOpen(false);
              router.refresh();
            } catch (err) {
              toast.error(actionErrorMessage(err, "Gagal mengirim pengajuan."));
            }
          })
        }
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus profil KOL ini?"
        description="Profil belum pernah aktif dan belum punya jadwal, jadi aman dihapus."
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            try {
              await deleteKolProfile(kolId);
              toast.success("Profil KOL dihapus.");
              router.push("/kol-hub/kols");
              router.refresh();
            } catch (err) {
              toast.error(actionErrorMessage(err, "Gagal menghapus profil."));
            }
          })
        }
      />
    </>
  );
}

export function PendingChangeBanner({
  requestId,
  label,
  requestedBy,
  createdAt,
  reason,
  isMine,
  canDecide,
  isCreate,
}: {
  requestId: string;
  label: string;
  requestedBy: string | null;
  createdAt: string;
  reason: string | null;
  isMine: boolean;
  canDecide: boolean;
  isCreate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div
      className={cn(
        lab.nestedPanel,
        "flex flex-wrap items-center justify-between gap-3 border-amber-500/30 bg-amber-500/8",
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Clock3 className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{label} menunggu approval</p>
          <p className="text-muted-foreground text-xs">
            Diajukan {requestedBy ? `oleh ${requestedBy} ` : ""}
            {formatWibDateTime(createdAt)}
            {reason ? ` — “${reason}”` : ""}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {canDecide ? (
          <Button size="sm" render={<Link href="/kol-hub/approvals" />}>
            Putuskan
          </Button>
        ) : null}
        {isMine && !isCreate ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await cancelKolChangeRequest(requestId);
                  toast.success("Pengajuan dibatalkan.");
                  router.refresh();
                } catch (err) {
                  toast.error(actionErrorMessage(err, "Gagal membatalkan pengajuan."));
                }
              })
            }
          >
            Batalkan pengajuan
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function AccountAuditButton({
  accountId,
  hasAudit,
}: {
  accountId: string;
  hasAudit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="inline-flex items-center gap-1 font-medium text-[var(--lab-accent,var(--primary))] hover:underline disabled:opacity-50"
      onClick={() =>
        startTransition(async () => {
          try {
            await runKolAccountAudit(accountId);
            toast.success("Audit dijalankan. Hasilnya muncul di sini dalam beberapa menit.");
            router.refresh();
          } catch (err) {
            toast.error(actionErrorMessage(err, "Gagal menjalankan audit."));
          }
        })
      }
    >
      <RefreshCw className={cn("size-3", pending && "animate-spin")} aria-hidden />
      {hasAudit ? "Audit ulang" : "Jalankan audit"}
    </button>
  );
}
