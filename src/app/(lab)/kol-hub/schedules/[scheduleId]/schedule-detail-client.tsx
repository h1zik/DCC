"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowUpRight, CalendarCog, CheckCircle2, Send, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  cancelSchedule,
  deleteDraftSchedule,
  markPostTakenDown,
  markScheduleReady,
  recordSchedulePost,
  submitDraftSchedules,
  updateScheduleLogistics,
  updateScheduleShipment,
} from "@/actions/kol-schedules";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, KolSelect } from "@/components/kol-hub/kol-fields";
import { ReasonDialog } from "@/components/kol-hub/reason-dialog";
import { LabCard, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { actionErrorMessage } from "@/lib/action-error-message";
import { SHIPMENT_META, type KolShipmentStatusValue } from "@/lib/kol/labels";
import { dateToWibInput, formatWibDateTime } from "@/lib/kol/time";
import { cn } from "@/lib/utils";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<unknown>, ok: string, after?: () => void) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
        after?.();
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Aksi gagal."));
      }
    });
  return { pending, run, router };
}

export function ScheduleActions({
  scheduleId,
  status,
  isRequester,
  logistics,
  briefs,
  users,
}: {
  scheduleId: string;
  status: string;
  isRequester: boolean;
  logistics: { scheduledAt: string; briefId: string; picUserId: string };
  briefs: { id: string; title: string }[];
  users: { id: string; name: string }[];
}) {
  const { pending, run, router } = useAction();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(logistics);

  const cancellable = ["PENDING_APPROVAL", "APPROVED", "SCHEDULED"].includes(status);
  const editable = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED"].includes(status);

  return (
    <>
      {status === "DRAFT" ? (
        <>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => submitDraftSchedules([scheduleId]), "Jadwal diajukan ke approver.")}
          >
            <Send />
            Ajukan
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)} aria-label="Hapus draf">
            <Trash2 />
          </Button>
        </>
      ) : null}
      {status === "APPROVED" ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => markScheduleReady(scheduleId), "Ditandai siap tayang.")}
        >
          <CheckCircle2 />
          Siap tayang
        </Button>
      ) : null}
      {editable ? (
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <CalendarCog />
          Ubah tanggal / brief
        </Button>
      ) : null}
      {cancellable && (isRequester || status !== "PENDING_APPROVAL") ? (
        <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)}>
          <XCircle />
          Batalkan
        </Button>
      ) : null}

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Batalkan jadwal ini?"
        description="Budget yang dipakai jadwal ini akan kembali. Tindakan ini tidak bisa diurungkan."
        placeholder="Mis. KOL tidak bisa memenuhi tanggal tayang"
        confirmLabel="Batalkan jadwal"
        destructive
        pending={pending}
        onConfirm={(reason) =>
          run(() => cancelSchedule(scheduleId, reason), "Jadwal dibatalkan.", () =>
            setCancelOpen(false),
          )
        }
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus draf ini?"
        description="Draf belum pernah diajukan, jadi aman dihapus."
        pending={pending}
        onConfirm={() =>
          run(() => deleteDraftSchedule(scheduleId), "Draf dihapus.", () =>
            router.push("/kol-hub/schedules"),
          )
        }
      />
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah tanggal, brief, atau PIC</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  updateScheduleLogistics({
                    scheduleId,
                    scheduledAt: form.scheduledAt || null,
                    briefId: form.briefId || null,
                    picUserId: form.picUserId || null,
                  }),
                "Jadwal diperbarui.",
                () => setEditOpen(false),
              );
            }}
          >
            <Field label="Tanggal & jam tayang (WIB)" htmlFor="lg-at">
              <Input
                id="lg-at"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            </Field>
            <Field label="Brief" optional>
              <KolSelect
                ariaLabel="Brief"
                value={form.briefId}
                onChange={(briefId) => setForm({ ...form, briefId })}
                emptyLabel="Tanpa brief"
                options={briefs.map((b) => ({ value: b.id, label: b.title }))}
              />
            </Field>
            <Field label="PIC" optional>
              <KolSelect
                ariaLabel="PIC"
                value={form.picUserId}
                onChange={(picUserId) => setForm({ ...form, picUserId })}
                emptyLabel="Tanpa PIC"
                options={users.map((u) => ({ value: u.id, label: u.name }))}
              />
            </Field>
            <p className="text-muted-foreground text-xs">
              Rate tidak bisa diubah setelah diajukan — batalkan lalu ajukan ulang bila
              nominalnya berubah.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={pending}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PostPanel({
  scheduleId,
  status,
  postStatus,
  postUrl,
  postedAt,
}: {
  scheduleId: string;
  status: string;
  postStatus: string;
  postUrl: string | null;
  postedAt: string | null;
}) {
  const { pending, run } = useAction();
  const [url, setUrl] = useState(postUrl ?? "");
  const [at, setAt] = useState(postedAt ? dateToWibInput(postedAt) : "");
  const canRecord = ["APPROVED", "SCHEDULED", "POSTED"].includes(status);

  return (
    <LabCard className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={lab.sectionTitle}>Tayang</h2>
        {postUrl ? (
          <a
            href={postUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
          >
            Buka post <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
      {!canRecord ? (
        <p className="text-muted-foreground text-sm">
          Link post bisa dicatat setelah jadwal disetujui.
        </p>
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => recordSchedulePost({ scheduleId, postUrl: url, postedAt: at || null }),
              postUrl ? "Link post diperbarui." : "Konten tercatat tayang.",
            );
          }}
        >
          <Field label="Link post" htmlFor="post-url">
            <Input
              id="post-url"
              type="url"
              placeholder="https://www.tiktok.com/@username/video/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </Field>
          <Field label="Waktu tayang (WIB)" htmlFor="post-at" optional>
            <Input
              id="post-at"
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={pending || !url}>
            {postUrl ? "Perbarui" : "Tandai tayang"}
          </Button>
        </form>
      )}
      {postedAt ? (
        <p className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          Tayang {formatWibDateTime(postedAt)}.
          {postStatus === "POSTED" ? (
            <button
              type="button"
              className="hover:text-foreground underline"
              disabled={pending}
              onClick={() => run(() => markPostTakenDown(scheduleId), "Ditandai diturunkan.")}
            >
              Konten sudah diturunkan KOL?
            </button>
          ) : null}
        </p>
      ) : null}
      <p className="text-muted-foreground mt-3 text-[11px]">
        Pelacakan views, CPM, dan deteksi FYP otomatis dari link ini hadir di tahap berikutnya.
      </p>
    </LabCard>
  );
}

export function ShipmentPanel({
  scheduleId,
  status,
  courier,
  trackingNumber,
}: {
  scheduleId: string;
  status: KolShipmentStatusValue;
  courier: string | null;
  trackingNumber: string | null;
}) {
  const { pending, run } = useAction();
  const [v, setV] = useState({
    status,
    courier: courier ?? "",
    trackingNumber: trackingNumber ?? "",
  });
  const dirty =
    v.status !== status || v.courier !== (courier ?? "") || v.trackingNumber !== (trackingNumber ?? "");

  return (
    <LabCard className="p-5">
      <h2 className={cn(lab.sectionTitle, "mb-3")}>Kirim produk</h2>
      <form
        className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              updateScheduleShipment({
                scheduleId,
                status: v.status,
                courier: v.courier || null,
                trackingNumber: v.trackingNumber || null,
              }),
            "Status kirim produk disimpan.",
          );
        }}
      >
        <Field label="Status">
          <KolSelect
            ariaLabel="Status kirim produk"
            value={v.status}
            onChange={(s) => setV({ ...v, status: (s || "PENDING") as KolShipmentStatusValue })}
            options={(Object.keys(SHIPMENT_META) as KolShipmentStatusValue[]).map((k) => ({
              value: k,
              label: SHIPMENT_META[k].label,
            }))}
          />
        </Field>
        <Field label="Kurir" htmlFor="ship-courier" optional>
          <Input
            id="ship-courier"
            value={v.courier}
            placeholder="Mis. JNE"
            onChange={(e) => setV({ ...v, courier: e.target.value })}
          />
        </Field>
        <Field label="No. resi" htmlFor="ship-awb" optional>
          <Input
            id="ship-awb"
            value={v.trackingNumber}
            onChange={(e) => setV({ ...v, trackingNumber: e.target.value })}
          />
        </Field>
        <Button type="submit" variant="outline" disabled={pending || !dirty}>
          Simpan
        </Button>
      </form>
    </LabCard>
  );
}
