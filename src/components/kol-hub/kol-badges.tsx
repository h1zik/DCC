import type { ReactNode } from "react";
import {
  KOL_STATUS_META,
  PAYMENT_META,
  PLATFORM_LABEL,
  SPK_META,
  type KolPaymentStatusValue,
  type KolSpkStatusValue,
  POST_STATUS_META,
  SCHEDULE_STATUS_META,
  SHIPMENT_META,
  TONE_CLASS,
  type KolPlatformValue,
  type KolPostStatusValue,
  type KolScheduleStatusValue,
  type KolShipmentStatusValue,
  type KolStatusValue,
  type Tone,
} from "@/lib/kol/labels";
import { cn } from "@/lib/utils";

export function KolBadge({
  tone,
  children,
  className,
  title,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function KolStatusBadge({ status }: { status: KolStatusValue }) {
  const m = KOL_STATUS_META[status];
  return <KolBadge tone={m.tone}>{m.label}</KolBadge>;
}

export function ScheduleStatusBadge({ status }: { status: KolScheduleStatusValue }) {
  const m = SCHEDULE_STATUS_META[status];
  return <KolBadge tone={m.tone}>{m.label}</KolBadge>;
}

/** Tanggal tayang sudah lewat (dibanding jam sekarang). */
function isPast(iso: string | null): boolean {
  return iso != null && new Date(iso).getTime() < Date.now();
}

/**
 * Status paralel satu jadwal dalam satu baris ringkas: persetujuan · tayang ·
 * kirim produk. Status turunan yang tidak relevan tidak dirender, supaya baris
 * tetap bisa dipindai cepat.
 */
export function ScheduleStatusStack({
  status,
  postStatus,
  shipmentStatus,
  scheduledAt,
  paymentStatus,
  spkStatus,
}: {
  status: KolScheduleStatusValue;
  postStatus: KolPostStatusValue;
  shipmentStatus: KolShipmentStatusValue;
  scheduledAt: string | null;
  paymentStatus?: KolPaymentStatusValue;
  spkStatus?: KolSpkStatusValue | null;
}) {
  const live = status === "APPROVED" || status === "SCHEDULED";
  const late = live && isPast(scheduledAt);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <ScheduleStatusBadge status={status} />
      {late ? <KolBadge tone="danger">Lewat jadwal</KolBadge> : null}
      {postStatus === "TAKEN_DOWN" ? (
        <KolBadge tone={POST_STATUS_META.TAKEN_DOWN.tone}>
          {POST_STATUS_META.TAKEN_DOWN.label}
        </KolBadge>
      ) : null}
      {shipmentStatus !== "NOT_REQUIRED" &&
      status !== "REJECTED" &&
      status !== "CANCELLED" &&
      status !== "DRAFT" ? (
        <KolBadge tone={SHIPMENT_META[shipmentStatus].tone}>
          {SHIPMENT_META[shipmentStatus].label}
        </KolBadge>
      ) : null}
      {spkStatus ? (
        <KolBadge tone={SPK_META[spkStatus].tone}>{SPK_META[spkStatus].label}</KolBadge>
      ) : null}
      {paymentStatus && paymentStatus !== "NONE" ? (
        <KolBadge tone={PAYMENT_META[paymentStatus].tone}>{PAYMENT_META[paymentStatus].label}</KolBadge>
      ) : null}
    </div>
  );
}

/** Tanda platform kecil (monogram, bukan logo merek). */
export function PlatformMark({
  platform,
  className,
}: {
  platform: KolPlatformValue;
  className?: string;
}) {
  return (
    <span
      title={PLATFORM_LABEL[platform]}
      aria-label={PLATFORM_LABEL[platform]}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-md text-[9px] font-bold tracking-tight",
        platform === "INSTAGRAM"
          ? "bg-gradient-to-br from-fuchsia-500/20 to-amber-400/25 text-fuchsia-700 dark:text-fuchsia-300"
          : "bg-foreground/10 text-foreground",
        className,
      )}
    >
      {platform === "INSTAGRAM" ? "IG" : "TT"}
    </span>
  );
}
