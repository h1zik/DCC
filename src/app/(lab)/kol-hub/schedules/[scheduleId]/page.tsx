import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { compactCount as compactNumber } from "@/lib/kol/format";
import {
  KolBadge,
  PlatformMark,
  ScheduleStatusBadge,
  ScheduleStatusStack,
} from "@/components/kol-hub/kol-badges";
import { LabDetailPage } from "@/components/lab/lab-module-page";
import { LabCard, lab } from "@/components/lab/lab-primitives";
import { canApproveKol, ensureKolHubPage } from "@/lib/kol/auth";
import { rupiah, rupiahShort } from "@/lib/kol/format";
import { OBJECTIVE_META, PAYMENT_META, PLACEMENT_LABEL, TIER_LABEL } from "@/lib/kol/labels";
import { PostMetricsPanel } from "@/components/kol-hub/post-metrics-panel";
import { getKolRateSettings } from "@/lib/kol/rate-context";
import {
  getScheduleDetail,
  getSpkForSchedule,
  listBriefs,
  listSpkTemplates,
  listUserOptions,
} from "@/lib/kol/readers";
import { SpkPanel } from "@/components/kol-hub/spk-panel";
import { dateToWibInput, formatWibDateTime } from "@/lib/kol/time";
import { cn } from "@/lib/utils";
import {
  PostPanel,
  ScheduleActions,
  ShipmentPanel,
} from "./schedule-detail-client";

export const metadata: Metadata = { title: "Jadwal · KOL Hub" };

const EVENT_LABEL: Record<string, string> = {
  "order.submitted": "Order diajukan",
  "order.drafted": "Order disimpan sebagai draf",
  "schedule.submitted": "Diajukan",
  "schedule.approved": "Disetujui",
  "schedule.rejected": "Ditolak",
  "schedule.cancelled": "Dibatalkan",
  "schedule.ready": "Ditandai siap tayang",
  "schedule.posted": "Link post dicatat",
  "schedule.taken_down": "Konten diturunkan",
  "schedule.shipment": "Status kirim produk diubah",
  "schedule.logistics": "Tanggal / brief / PIC diubah",
};

function Stepper({ status }: { status: string }) {
  const steps = [
    { key: "PENDING_APPROVAL", label: "Diajukan" },
    { key: "APPROVED", label: "Disetujui" },
    { key: "SCHEDULED", label: "Siap tayang" },
    { key: "POSTED", label: "Tayang" },
  ];
  const order = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "POSTED"];
  const idx = order.indexOf(status);
  const stopped = status === "REJECTED" || status === "CANCELLED";
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Alur jadwal">
      {steps.map((s, i) => {
        const done = !stopped && idx >= order.indexOf(s.key);
        return (
          <li key={s.key} className="flex flex-col gap-1.5">
            <span
              className={cn(
                "h-1.5 rounded-full",
                done ? "bg-[var(--lab-accent,var(--primary))]" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "text-[11px]",
                done ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {i + 1}. {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-muted-foreground text-[11px]">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ scheduleId: string }>;
}) {
  const { scheduleId } = await params;
  const { session } = await ensureKolHubPage();
  const s = await getScheduleDetail(scheduleId);
  if (!s) notFound();
  const [briefs, users, settings, spkTemplates, spkDoc, approver] = await Promise.all([
    listBriefs(s.brandId),
    listUserOptions(),
    getKolRateSettings(),
    listSpkTemplates(s.brandId),
    getSpkForSchedule(s.id),
    canApproveKol(),
  ]);
  const canAccessSpk =
    approver || s.requestedById === session.user.id || s.picUserId === session.user.id;
  const total = s.rate + s.additionalCost;
  const productValue = s.products.reduce((a, p) => a + (p.unitValue ?? 0) * p.quantity, 0);

  return (
    <LabDetailPage
      icon={ClipboardList}
      backHref="/kol-hub/schedules"
      title={`${s.kolName} · ${PLACEMENT_LABEL[s.placement]}`}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums">{s.subNumber}</span>
          <ScheduleStatusStack
            status={s.status}
            postStatus={s.postStatus}
            shipmentStatus={s.shipmentStatus}
            scheduledAt={s.scheduledAt}
            paymentStatus={s.paymentStatus}
            spkStatus={s.spkStatus}
          />
        </span>
      }
      right={
        <ScheduleActions
          scheduleId={s.id}
          status={s.status}
          isRequester={s.requestedById === session.user.id}
          logistics={{
            scheduledAt: dateToWibInput(s.scheduledAt),
            briefId: s.briefId ?? "",
            picUserId: s.picUserId ?? "",
          }}
          briefs={briefs.map((b) => ({ id: b.id, title: b.title }))}
          users={users}
        />
      }
    >
      <LabCard className="p-5">
        <Stepper status={s.status} />
        {s.status === "REJECTED" || s.status === "CANCELLED" ? (
          <p className="mt-3 text-sm">
            <span className="font-semibold">
              {s.status === "REJECTED" ? "Ditolak" : "Dibatalkan"}
            </span>
            {s.decidedBy ? ` oleh ${s.decidedBy}` : ""}
            {s.decisionNote ? ` — “${s.decisionNote}”` : ""}
          </p>
        ) : s.decidedBy && s.status !== "PENDING_APPROVAL" ? (
          <p className="text-muted-foreground mt-3 text-xs">
            Disetujui {s.decidedBy}
            {s.decidedAt ? `, ${formatWibDateTime(s.decidedAt)}` : ""}
            {s.decisionNote ? ` — “${s.decisionNote}”` : ""}
          </p>
        ) : null}
      </LabCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <LabCard className="p-5">
            <h2 className={cn(lab.sectionTitle, "mb-4")}>Konten</h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Item label="Akun">
                <a
                  href={s.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium hover:underline"
                >
                  <PlatformMark platform={s.platform} />@{s.handle}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
                {s.followers != null ? (
                  <span className="text-muted-foreground block text-xs">
                    {compactNumber(s.followers)} followers
                    {s.tier ? ` · ${TIER_LABEL[s.tier] ?? s.tier}` : ""}
                  </span>
                ) : null}
              </Item>
              <Item label="Tayang (WIB)">{formatWibDateTime(s.scheduledAt)}</Item>
              <Item label="Tujuan">{OBJECTIVE_META[s.objective].label}</Item>
              <Item label="Campaign">
                <Link href={`/kol-hub/campaigns/${s.campaignId}`} className="hover:underline">
                  {s.campaignTitle}
                </Link>
                <span className="text-muted-foreground block text-xs">{s.brandName}</span>
              </Item>
              <Item label="Brief">{s.briefTitle ?? <span className="text-muted-foreground">Tanpa brief</span>}</Item>
              <Item label="PIC">{s.picName ?? "—"}</Item>
            </dl>
            {s.products.length ? (
              <div className="mt-5 border-t border-border/60 pt-4">
                <p className="text-muted-foreground mb-2 text-[11px]">Produk</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {s.products.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span>
                        {p.name} <span className="text-muted-foreground text-xs">{p.sku}</span>
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {p.quantity} × {p.unitValue != null ? rupiahShort(p.unitValue) : "harga belum diisi"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </LabCard>

          <PostPanel
            scheduleId={s.id}
            status={s.status}
            postStatus={s.postStatus}
            postUrl={s.postUrl}
            postedAt={s.postedAt}
          />

          <PostMetricsPanel
            scheduleId={s.id}
            canSync={s.status === "POSTED" && !!s.postUrl && s.postStatus !== "TAKEN_DOWN"}
            snapshots={s.snapshots}
            cost={total}
            fypThreshold={settings.configs[s.platform].fypThreshold}
            postedAt={s.postedAt}
            followersAtBooking={s.followersAtBooking}
            syncedAt={s.metricsSyncedAt}
            error={s.metricsError}
            syncing={s.syncInFlight}
          />

          <SpkPanel
            scheduleId={s.id}
            scheduleStatus={s.status}
            canAccess={canAccessSpk}
            templates={spkTemplates.map((t) => ({
              id: t.id,
              name: t.name,
              isDefault: t.isDefault,
              scope: t.scope,
            }))}
            doc={spkDoc}
          />

          {s.shipmentStatus !== "NOT_REQUIRED" || s.products.length ? (
            <ShipmentPanel
              scheduleId={s.id}
              status={s.shipmentStatus}
              courier={s.courier}
              trackingNumber={s.trackingNumber}
            />
          ) : null}

          <LabCard className="p-5">
            <h2 className={cn(lab.sectionTitle, "mb-3")}>Aktivitas</h2>
            <ol className="flex flex-col gap-2.5">
              {s.events.map((e) => (
                <li key={e.id} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 text-sm">
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {formatWibDateTime(e.createdAt).replace(" WIB", "")}
                  </span>
                  <span>
                    {EVENT_LABEL[e.action] ?? e.action}{" "}
                    <span className="text-muted-foreground">oleh {e.actor}</span>
                    {typeof e.meta?.reason === "string" ? (
                      <span className="text-muted-foreground"> — “{e.meta.reason}”</span>
                    ) : null}
                    {typeof e.meta?.note === "string" ? (
                      <span className="text-muted-foreground"> — “{e.meta.note}”</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </LabCard>
        </div>

        <aside className="flex flex-col gap-4">
          <LabCard className="p-5">
            <h2 className={cn(lab.sectionTitle, "mb-3")}>Biaya</h2>
            <dl className="flex flex-col gap-1.5 text-sm tabular-nums">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rate KOL ({s.endorseType})</dt>
                <dd>{rupiah(s.rate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Biaya tambahan</dt>
                <dd>{rupiah(s.additionalCost)}</dd>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd>{rupiah(total)}</dd>
              </div>
              {productValue > 0 ? (
                <div className="text-muted-foreground flex justify-between text-xs">
                  <dt>Nilai produk dikirim</dt>
                  <dd>{rupiah(productValue)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-4 border-t border-border/60 pt-3 text-xs">
              <p className="mb-1 flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Pembayaran</span>
                <KolBadge tone={PAYMENT_META[s.paymentStatus].tone}>
                  {PAYMENT_META[s.paymentStatus].label}
                </KolBadge>
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {s.paymentStatus === "NONE"
                  ? total > 0
                    ? "Pengajuan dana ke Finance dibuat otomatis saat jadwal disetujui."
                    : "Barter — tidak ada fee yang dibayar."
                  : s.paymentStatus === "REJECTED"
                    ? `Finance menolak / menarik pengajuan${s.paymentNote ? `: “${s.paymentNote}”` : "."}`
                    : "Diproses di Finance › Expense Approvals (akun Beban pemasaran & iklan). Status di sini selalu mengikuti Finance."}
              </p>
            </div>
          </LabCard>

          <LabCard className="p-5">
            <h2 className={cn(lab.sectionTitle, "mb-1")}>Order {s.orderNumber}</h2>
            <p className="text-muted-foreground mb-3 text-xs">
              Diajukan {s.requestedBy ?? "—"}
              {s.submittedAt ? `, ${formatWibDateTime(s.submittedAt)}` : ""}
            </p>
            <ul className="flex flex-col gap-1.5">
              {s.siblings.map((x) => (
                <li key={x.id}>
                  <Link
                    href={`/kol-hub/schedules/${x.id}`}
                    aria-current={x.id === s.id ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors",
                      x.id === s.id ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="min-w-0 truncate">
                      {x.subNumber.slice(-2)} · {PLACEMENT_LABEL[x.placement]}
                    </span>
                    <ScheduleStatusBadge status={x.status} />
                  </Link>
                </li>
              ))}
            </ul>
            {s.orderNote ? (
              <p className="text-muted-foreground mt-3 border-t border-border/60 pt-3 text-xs whitespace-pre-line">
                {s.orderNote}
              </p>
            ) : null}
          </LabCard>
        </aside>
      </div>
    </LabDetailPage>
  );
}
