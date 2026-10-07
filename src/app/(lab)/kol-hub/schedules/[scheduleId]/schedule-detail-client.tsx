"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowUpRight, CheckCircle2, Pencil, Send, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  cancelSchedule,
  deleteDraftSchedule,
  markPostTakenDown,
  markScheduleReady,
  recordSchedulePost,
  submitDraftSchedules,
  updateScheduleContent,
  updateScheduleShipment,
} from "@/actions/kol-schedules";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PlatformMark } from "@/components/kol-hub/kol-badges";
import { Field, KolSelect, RupiahInput } from "@/components/kol-hub/kol-fields";
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
import { rupiah } from "@/lib/kol/format";
import {
  OBJECTIVE_META,
  PLACEMENT_LABEL,
  PLACEMENTS_BY_PLATFORM,
  SHIPMENT_META,
  type KolObjectiveValue,
  type KolPlacementValue,
  type KolPlatformValue,
  type KolShipmentStatusValue,
} from "@/lib/kol/labels";
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
  initial,
  options,
}: {
  scheduleId: string;
  status: string;
  isRequester: boolean;
  initial: ScheduleEditValues;
  options: ScheduleEditOptions;
}) {
  const { pending, run, router } = useAction();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // Tiap buka = form baru dari data tersimpan, bukan sisa ketikan yang dibatalkan.
  const [editKey, setEditKey] = useState(0);

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
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditKey((k) => k + 1);
            setEditOpen(true);
          }}
        >
          <Pencil />
          Edit jadwal
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
      {editable ? (
        <ScheduleEditDialog
          key={editKey}
          open={editOpen}
          onOpenChange={setEditOpen}
          scheduleId={scheduleId}
          moneyLocked={status === "APPROVED" || status === "SCHEDULED"}
          initial={initial}
          options={options}
        />
      ) : null}
    </>
  );
}

export type ScheduleEditValues = {
  socialAccountId: string;
  placement: KolPlacementValue;
  endorseTypeId: string;
  objective: KolObjectiveValue;
  scheduledAt: string;
  briefId: string;
  picUserId: string;
  productIds: string[];
  rate: string;
  additionalCost: string;
};

export type ScheduleEditOptions = {
  accounts: { id: string; platform: KolPlatformValue; handle: string; rateCard: number | null }[];
  endorseTypes: { id: string; name: string; isBarter: boolean }[];
  briefs: { id: string; title: string }[];
  products: { id: string; name: string }[];
  users: { id: string; name: string }[];
};

function ScheduleEditDialog({
  open,
  onOpenChange,
  scheduleId,
  moneyLocked,
  initial,
  options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  moneyLocked: boolean;
  initial: ScheduleEditValues;
  options: ScheduleEditOptions;
}) {
  const { pending, run } = useAction();
  const [form, setForm] = useState(initial);
  const patch = (p: Partial<ScheduleEditValues>) => setForm((cur) => ({ ...cur, ...p }));

  const account = options.accounts.find((a) => a.id === form.socialAccountId);
  const placements = account ? PLACEMENTS_BY_PLATFORM[account.platform] : [];
  const barter = options.endorseTypes.find((t) => t.id === form.endorseTypeId)?.isBarter ?? false;
  const initialBarter = options.endorseTypes.find((t) => t.id === initial.endorseTypeId)?.isBarter;
  // Setelah disetujui nominal terkunci — termasuk ganti jenis endorse barter ⇄ berbayar.
  const endorseOptions = moneyLocked
    ? options.endorseTypes.filter((t) => t.isBarter === initialBarter)
    : options.endorseTypes;
  const total = (barter ? 0 : Number(form.rate || 0)) + Number(form.additionalCost || 0);

  function chooseAccount(id: string) {
    const a = options.accounts.find((x) => x.id === id);
    if (!a) return;
    const allowed = PLACEMENTS_BY_PLATFORM[a.platform];
    patch({
      socialAccountId: id,
      placement: allowed.includes(form.placement) ? form.placement : allowed[0],
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit jadwal</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                updateScheduleContent({
                  scheduleId,
                  socialAccountId: form.socialAccountId,
                  placement: form.placement,
                  endorseTypeId: form.endorseTypeId,
                  objective: form.objective,
                  scheduledAt: form.scheduledAt || null,
                  briefId: form.briefId || null,
                  picUserId: form.picUserId || null,
                  productIds: form.productIds,
                  rate: barter ? "0" : form.rate || "0",
                  additionalCost: form.additionalCost || null,
                }),
              "Jadwal diperbarui.",
              () => onOpenChange(false),
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Akun">
              <KolSelect
                ariaLabel="Akun"
                value={form.socialAccountId}
                onChange={chooseAccount}
                options={options.accounts.map((a) => ({
                  value: a.id,
                  label: (
                    <span className="flex items-center gap-1.5">
                      <PlatformMark platform={a.platform} />@{a.handle}
                    </span>
                  ),
                }))}
              />
            </Field>
            <Field label="Placement">
              <KolSelect
                ariaLabel="Placement"
                value={form.placement}
                onChange={(v) => patch({ placement: v as KolPlacementValue })}
                options={placements.map((p) => ({ value: p, label: PLACEMENT_LABEL[p] }))}
              />
            </Field>
            <Field label="Jenis endorse">
              <KolSelect
                ariaLabel="Jenis endorse"
                value={form.endorseTypeId}
                onChange={(v) => patch({ endorseTypeId: v })}
                options={endorseOptions.map((t) => ({
                  value: t.id,
                  label: t.isBarter ? `${t.name} (tanpa fee)` : t.name,
                }))}
              />
            </Field>
          </div>

          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-xs font-medium">Tujuan konten</legend>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1">
              {(Object.keys(OBJECTIVE_META) as KolObjectiveValue[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={form.objective === o}
                  title={OBJECTIVE_META[o].hint}
                  onClick={() => patch({ objective: o })}
                  className={cn(
                    "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                    form.objective === o
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {OBJECTIVE_META[o].label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tanggal & jam tayang (WIB)" htmlFor="ed-at" optional>
              <Input
                id="ed-at"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => patch({ scheduledAt: e.target.value })}
              />
            </Field>
            <Field label="Brief" optional>
              <KolSelect
                ariaLabel="Brief"
                value={form.briefId}
                onChange={(briefId) => patch({ briefId })}
                emptyLabel="Tanpa brief"
                options={options.briefs.map((b) => ({ value: b.id, label: b.title }))}
              />
            </Field>
            <Field label="PIC" optional>
              <KolSelect
                ariaLabel="PIC"
                value={form.picUserId}
                onChange={(picUserId) => patch({ picUserId })}
                emptyLabel="Tanpa PIC"
                options={options.users.map((u) => ({ value: u.id, label: u.name }))}
              />
            </Field>
          </div>

          <Field
            label="Produk yang di-endorse"
            optional
            hint={options.products.length === 0 ? "Brand ini belum punya produk di master Products." : undefined}
          >
            <div className="flex flex-wrap gap-1.5">
              {options.products.map((p) => {
                const on = form.productIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      patch({
                        productIds: on
                          ? form.productIds.filter((x) => x !== p.id)
                          : [...form.productIds, p.id],
                      })
                    }
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                      on
                        ? "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_14%,transparent)] text-[var(--lab-accent,var(--primary))] ring-[color-mix(in_srgb,var(--lab-accent,var(--primary))_35%,transparent)]"
                        : "text-muted-foreground ring-border hover:text-foreground",
                    )}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Rate KOL"
              hint={
                barter
                  ? "Barter — tidak ada fee."
                  : account?.rateCard != null
                    ? `Rate card akun ini ${rupiah(account.rateCard)}.`
                    : undefined
              }
            >
              <RupiahInput
                ariaLabel="Rate KOL"
                value={barter ? "0" : form.rate}
                disabled={barter || moneyLocked}
                onChange={(rate) => patch({ rate })}
              />
            </Field>
            <Field label="Biaya tambahan" optional>
              <RupiahInput
                ariaLabel="Biaya tambahan"
                value={form.additionalCost}
                disabled={moneyLocked}
                onChange={(additionalCost) => patch({ additionalCost })}
              />
            </Field>
          </div>

          <p className="text-muted-foreground text-xs">
            Total <span className="text-foreground font-semibold tabular-nums">{rupiah(total)}</span>
            {moneyLocked
              ? " · Nominal terkunci karena jadwal sudah disetujui dan pengajuan dana sudah ke Finance — batalkan lalu ajukan ulang bila nominalnya berubah."
              : " · Bila jadwal sedang menunggu approval, kenaikan nominal dicek ke sisa budget."}
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending || !form.placement}>
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
              placeholder="https://www.tiktok.com/@username/video/… atau instagram.com/reel/…"
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
