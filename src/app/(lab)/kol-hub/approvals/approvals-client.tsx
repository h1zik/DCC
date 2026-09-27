"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, CheckCheck, Inbox, X } from "lucide-react";
import { InfluencerVerdict } from "@prisma/client";
import { toast } from "sonner";
import { decideKolChange, decideSchedules } from "@/actions/kol-approvals";
import { compactNumber, VerdictBadge } from "@/components/brand-hub/influencer-badges";
import { BudgetMeter } from "@/components/kol-hub/budget-meter";
import { KolBadge, PlatformMark } from "@/components/kol-hub/kol-badges";
import { ReasonDialog } from "@/components/kol-hub/reason-dialog";
import { LabCard, LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/action-error-message";
import { rupiah, rupiahShort } from "@/lib/kol/format";
import {
  KOL_CHANGE_TYPE_LABEL,
  OBJECTIVE_META,
  PLACEMENT_LABEL,
  TIER_LABEL,
} from "@/lib/kol/labels";
import type { ApprovalQueue } from "@/lib/kol/readers";
import { formatWibDateTime } from "@/lib/kol/time";
import { cn } from "@/lib/utils";

type Pending =
  | { kind: "schedules"; ids: string[]; approve: boolean; title: string }
  | { kind: "change"; id: string; approve: boolean; title: string }
  | null;

export function ApprovalsClient({
  queue,
  approver,
  currentUserId,
}: {
  queue: ApprovalQueue;
  approver: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Pending>(null);

  function run(p: NonNullable<Pending>, note: string) {
    startTransition(async () => {
      try {
        if (p.kind === "schedules") {
          await decideSchedules({ scheduleIds: p.ids, approve: p.approve, note: note || null });
          toast.success(
            p.approve ? `${p.ids.length} jadwal disetujui.` : `${p.ids.length} jadwal ditolak.`,
          );
        } else {
          await decideKolChange({ id: p.id, approve: p.approve, note: note || null });
          toast.success(p.approve ? "Pengajuan disetujui." : "Pengajuan ditolak.");
        }
        setDialog(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan keputusan."));
      }
    });
  }

  const empty = queue.orders.length === 0 && queue.changes.length === 0;
  if (empty) {
    return (
      <LabEmptyState
        icon={Inbox}
        title="Tidak ada yang menunggu keputusan"
        description="Pengajuan jadwal dan profil KOL baru akan muncul di sini."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {queue.orders.length ? (
        <section className={lab.section}>
          <h2 className={lab.sectionTitle}>Jadwal endorsement</h2>
          <div className="flex flex-col gap-4">
            {queue.orders.map((o) => {
              const mine = o.requestedById === currentUserId;
              const ids = o.slots.map((s) => s.id);
              return (
                <LabCard key={o.orderId} className="p-0">
                  <div className="grid gap-4 border-b border-border/60 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">
                        {o.orderNumber} · diajukan {o.requestedBy ?? "—"}
                        {o.submittedAt ? `, ${formatWibDateTime(o.submittedAt)}` : ""}
                      </p>
                      <h3 className="mt-1 text-base font-semibold">
                        <Link href={`/kol-hub/kols/${o.kolId}`} className="hover:underline">
                          {o.kolName}
                        </Link>
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {o.brandName} — {o.campaignTitle}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">{o.budgetName}</span>
                        <span className="font-semibold tabular-nums">{rupiah(o.total)}</span>
                      </div>
                      <BudgetMeter
                        beginning={o.budgetBeginning}
                        committed={o.budgetBeginning - o.budgetRemaining}
                        pending={o.total}
                      />
                    </div>
                  </div>

                  <ul className="divide-y divide-border/50">
                    {o.slots.map((s) => (
                      <li
                        key={s.id}
                        className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <PlatformMark platform={s.platform} />
                          <span className="font-medium">@{s.handle}</span>
                          <span className="text-muted-foreground">
                            {PLACEMENT_LABEL[s.placement]} · {OBJECTIVE_META[s.objective].label} ·{" "}
                            {s.endorseType}
                          </span>
                          {s.followers != null ? (
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {compactNumber(s.followers)} followers
                              {s.tier ? ` · ${TIER_LABEL[s.tier] ?? s.tier}` : ""}
                            </span>
                          ) : null}
                          <span className="text-muted-foreground w-full text-xs">
                            {s.scheduledAt ? formatWibDateTime(s.scheduledAt) : "Tanggal tayang belum diisi"}
                            {s.briefTitle ? ` · Brief: ${s.briefTitle}` : " · Tanpa brief"}
                            {s.products.length
                              ? ` · ${s.products.map((p) => p.name).join(", ")}`
                              : ""}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <span className="text-right text-sm tabular-nums">
                            {rupiahShort(s.rate)}
                            {s.additionalCost ? (
                              <span className="text-muted-foreground block text-[11px]">
                                + {rupiahShort(s.additionalCost)} biaya lain
                              </span>
                            ) : null}
                          </span>
                          {approver && !mine && o.slots.length > 1 ? (
                            <span className="flex gap-1">
                              <Button
                                size="icon-sm"
                                variant="outline"
                                aria-label={`Setujui ${s.subNumber}`}
                                title="Setujui slot ini"
                                disabled={busy}
                                onClick={() =>
                                  setDialog({
                                    kind: "schedules",
                                    ids: [s.id],
                                    approve: true,
                                    title: `Setujui ${s.subNumber}?`,
                                  })
                                }
                              >
                                <Check />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Tolak ${s.subNumber}`}
                                title="Tolak slot ini"
                                disabled={busy}
                                onClick={() =>
                                  setDialog({
                                    kind: "schedules",
                                    ids: [s.id],
                                    approve: false,
                                    title: `Tolak ${s.subNumber}?`,
                                  })
                                }
                              >
                                <X />
                              </Button>
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 sm:px-5">
                    <p className="text-muted-foreground text-xs">
                      {mine
                        ? "Pengajuanmu — perlu diputus approver lain."
                        : !approver
                          ? "Menunggu approver KOL Hub."
                          : o.slots.length > 1
                            ? "Putuskan per slot, atau sekaligus untuk semua slot."
                            : ""}
                    </p>
                    {approver && !mine ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            setDialog({
                              kind: "schedules",
                              ids,
                              approve: false,
                              title: `Tolak ${ids.length} jadwal ${o.kolName}?`,
                            })
                          }
                        >
                          Tolak{o.slots.length > 1 ? " semua" : ""}
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            setDialog({
                              kind: "schedules",
                              ids,
                              approve: true,
                              title: `Setujui ${ids.length} jadwal ${o.kolName}?`,
                            })
                          }
                        >
                          <CheckCheck />
                          Setujui{o.slots.length > 1 ? ` ${o.slots.length} slot` : ""}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </LabCard>
              );
            })}
          </div>
        </section>
      ) : null}

      {queue.changes.length ? (
        <section className={lab.section}>
          <h2 className={lab.sectionTitle}>Profil KOL</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {queue.changes.map((c) => {
              const mine = c.requestedById === currentUserId;
              const proposal =
                c.type === "EDIT" && c.payload
                  ? (c.payload as {
                      fullName?: string;
                      socialAccounts?: { platform: string; handle: string; rateCard?: string | null }[];
                    })
                  : null;
              return (
                <LabCard key={c.id} className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <KolBadge tone={c.type === "BLACKLIST" ? "danger" : "warning"}>
                        {KOL_CHANGE_TYPE_LABEL[c.type]}
                      </KolBadge>
                      <h3 className="mt-1.5 text-base font-semibold">
                        <Link href={`/kol-hub/kols/${c.kol.id}`} className="hover:underline">
                          {c.kol.fullName}
                        </Link>
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        Diajukan {c.requestedBy ?? "—"}, {formatWibDateTime(c.createdAt)}
                      </p>
                    </div>
                  </div>

                  <ul className="flex flex-col gap-1.5">
                    {c.kol.accounts.map((a) => (
                      <li
                        key={a.id}
                        className={cn(lab.nestedPanel, "flex flex-wrap items-center gap-2 p-2.5 text-xs")}
                      >
                        <PlatformMark platform={a.platform} />
                        <span className="font-medium">@{a.handle}</span>
                        {a.followers != null ? (
                          <span className="text-muted-foreground tabular-nums">
                            {compactNumber(a.followers)}
                          </span>
                        ) : null}
                        <span className="ml-auto">
                          <VerdictBadge
                            verdict={(a.audit?.verdict as InfluencerVerdict | null) ?? null}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>

                  {c.reason ? (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Alasan: </span>“{c.reason}”
                    </p>
                  ) : null}
                  {proposal ? (
                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1 text-xs">Data usulan</p>
                      <p>{proposal.fullName}</p>
                      <ul className="text-muted-foreground text-xs">
                        {proposal.socialAccounts?.map((a, i) => (
                          <li key={i}>
                            {a.platform === "TIKTOK" ? "TikTok" : "Instagram"} {a.handle}
                            {a.rateCard ? ` · rate ${rupiahShort(Number(a.rateCard))}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {c.type === "CREATE" && c.kol.accounts.every((a) => !a.audit) ? (
                    <p className="text-muted-foreground text-xs">
                      Akun belum diaudit. Jalankan audit dari profil KOL untuk melihat
                      keaslian engagement sebelum menyetujui.
                    </p>
                  ) : null}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <p className="text-muted-foreground text-xs">
                      {mine ? "Pengajuanmu — perlu diputus approver lain." : !approver ? "Menunggu approver." : ""}
                    </p>
                    {approver && !mine ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            setDialog({
                              kind: "change",
                              id: c.id,
                              approve: false,
                              title: `Tolak: ${KOL_CHANGE_TYPE_LABEL[c.type]} ${c.kol.fullName}?`,
                            })
                          }
                        >
                          Tolak
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            setDialog({
                              kind: "change",
                              id: c.id,
                              approve: true,
                              title: `Setujui: ${KOL_CHANGE_TYPE_LABEL[c.type]} ${c.kol.fullName}?`,
                            })
                          }
                        >
                          <Check />
                          Setujui
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </LabCard>
              );
            })}
          </div>
        </section>
      ) : null}

      <ReasonDialog
        open={dialog != null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.title ?? ""}
        description={
          dialog?.approve
            ? "Catatan akan dikirim ke pengaju bersama notifikasinya."
            : "Pengaju menerima alasan ini supaya tahu apa yang perlu diperbaiki."
        }
        label={dialog?.approve ? "Catatan" : "Alasan penolakan"}
        required={!dialog?.approve}
        confirmLabel={dialog?.approve ? "Setujui" : "Tolak"}
        destructive={!dialog?.approve}
        pending={busy}
        onConfirm={(note) => dialog && run(dialog, note)}
      />
    </div>
  );
}
