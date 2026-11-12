"use client";

import Link from "next/link";
import type { RoomCalendarEventKind, RoomCampaignStatus } from "@prisma/client";
import { AtSign, Check, ExternalLink, Moon, Send } from "lucide-react";
import {
  JENIS_LABEL,
  PLATFORM_SHORT_LABEL,
  sortPlatforms,
} from "@/lib/content-plan-ui";
import {
  CAMPAIGN_BAND_CLASS,
  EVENT_KIND_LABEL,
  campaignStyle,
} from "@/lib/room-calendar/campaign-ui";
import { formatDayShort } from "@/lib/room-calendar/dates";
import { EVENT_KIND_ICON } from "@/lib/room-calendar/kind-icon";
import type { Moment } from "@/lib/room-calendar/moments";
import {
  eventDays,
  eventTimeLabel,
  memberInitials,
  memberName,
  type CalCampaign,
  type CalContentPost,
  type CalEvent,
  type CalKolPost,
  type CalMember,
} from "@/lib/room-calendar/types";
import { cn } from "@/lib/utils";

export function KindIcon({
  kind,
  className,
}: {
  kind: RoomCalendarEventKind;
  className?: string;
}) {
  const Icon = EVENT_KIND_ICON[kind];
  return <Icon className={className} aria-hidden />;
}

/** Potongan pita kecil: warna = campaign, tekstur = status. */
export function CampaignSwatch({
  color,
  status,
  className,
}: {
  color: string;
  status: RoomCampaignStatus;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={campaignStyle(color)}
      className={cn(
        "inline-block h-3 w-5 shrink-0 rounded-[3px]",
        CAMPAIGN_BAND_CLASS[status],
        className,
      )}
    />
  );
}

const AVATAR_TONES = [
  "bg-slate-600",
  "bg-stone-600",
  "bg-zinc-700",
  "bg-neutral-500",
  "bg-slate-800",
] as const;

function avatarTone(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 997;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

/** Avatar netral: warna di kalender ini hanya dipakai untuk campaign. */
export function MemberAvatar({
  member,
  className,
}: {
  member: CalMember;
  className?: string;
}) {
  const name = memberName(member);
  if (member.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.image}
        alt={name}
        title={name}
        className={cn(
          "ring-card size-5 rounded-full object-cover ring-2",
          className,
        )}
      />
    );
  }
  return (
    <span
      title={name}
      className={cn(
        "ring-card flex size-5 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-2",
        avatarTone(member.id),
        className,
      )}
    >
      {memberInitials(member)}
    </span>
  );
}

export function MemberAvatars({
  members,
  max = 3,
}: {
  members: CalMember[];
  max?: number;
}) {
  if (members.length === 0) return null;
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="flex shrink-0 -space-x-1.5">
      {shown.map((m) => (
        <MemberAvatar key={m.id} member={m} />
      ))}
      {extra > 0 ? (
        <span className="bg-muted text-muted-foreground ring-card flex size-5 items-center justify-center rounded-full text-[8px] font-semibold ring-2">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

/** Baris aktivitas di daftar (popover hari, agenda, sheet campaign). */
export function EventRow({
  event,
  campaign,
  showCampaign = true,
  dateLabel,
  onOpen,
  onToggleDone,
}: {
  event: CalEvent;
  campaign: Pick<CalCampaign, "color" | "name"> | null;
  showCampaign?: boolean;
  /** Ganti label waktu dengan tanggal (dipakai sheet campaign). */
  dateLabel?: string;
  onOpen: (event: CalEvent) => void;
  onToggleDone: (event: CalEvent, done: boolean) => void;
}) {
  const done = Boolean(event.doneAt);
  const days = eventDays(event);
  const time = event.allDay ? "Sepanjang hari" : eventTimeLabel(event);
  const until =
    days.start !== days.end ? `sampai ${formatDayShort(days.end)}` : null;

  return (
    <div
      style={campaignStyle(campaign?.color)}
      className="flex items-start gap-2 rounded-md px-1.5 py-1"
    >
      <span className="flex w-5 shrink-0 justify-center pt-0.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={
            done
              ? `Batalkan selesai: ${event.title}`
              : `Tandai selesai: ${event.title}`
          }
          onClick={() => onToggleDone(event, !done)}
          className={cn(
            "focus-visible:ring-ring flex size-4 shrink-0 items-center justify-center rounded-full border outline-none focus-visible:ring-2",
            done
              ? "border-transparent bg-[var(--cmp)] text-white"
              : "border-[color-mix(in_oklab,var(--cmp)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--cmp)_18%,transparent)]",
          )}
        >
          {done ? <Check className="size-3" aria-hidden /> : null}
        </button>
      </span>
      <button
        type="button"
        onClick={() => onOpen(event)}
        className="hover:bg-muted/60 focus-visible:ring-ring -my-0.5 min-w-0 flex-1 rounded px-1 py-0.5 text-left outline-none focus-visible:ring-2"
      >
        <span className="flex items-center gap-1.5">
          <KindIcon
            kind={event.kind}
            className="text-muted-foreground size-3.5 shrink-0"
          />
          <span
            className={cn(
              "truncate text-sm font-medium",
              done && "text-muted-foreground line-through",
            )}
          >
            {event.title}
          </span>
        </span>
        <span className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 text-xs">
          <span className="tabular-nums">{dateLabel ?? time}</span>
          {until && !dateLabel ? <span>{until}</span> : null}
          <span>{EVENT_KIND_LABEL[event.kind]}</span>
          {event.location ? (
            <span className="truncate">{event.location}</span>
          ) : null}
          {showCampaign && campaign ? (
            <span className="text-foreground/80 truncate">{campaign.name}</span>
          ) : null}
        </span>
      </button>
    </div>
  );
}

/** Baris jadwal posting Content Plan (baca-saja, membuka sumbernya). */
export function ContentPostRow({ post }: { post: CalContentPost }) {
  const platforms = sortPlatforms(post.platforms)
    .map((p) => PLATFORM_SHORT_LABEL[p])
    .join(" ");
  return (
    <Link
      href={post.href}
      className="hover:bg-muted/60 focus-visible:ring-ring group/link flex items-start gap-2 rounded-md px-1.5 py-1 outline-none focus-visible:ring-2"
    >
      <span className="flex w-5 shrink-0 justify-center pt-0.5">
        <Send className="text-muted-foreground size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm",
            post.published && "text-muted-foreground",
          )}
        >
          {post.title}
        </span>
        <span className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
          {post.time ? (
            <span className="tabular-nums">{post.time.replace(":", ".")}</span>
          ) : null}
          <span>{JENIS_LABEL[post.jenis]}</span>
          {platforms ? <span>{platforms}</span> : null}
          {post.planTitle ? (
            <span className="truncate">{post.planTitle}</span>
          ) : null}
          {post.published ? <span>Sudah tayang</span> : null}
        </span>
      </span>
      <ExternalLink
        className="text-muted-foreground/0 group-hover/link:text-muted-foreground mt-1 size-3 shrink-0"
        aria-hidden
      />
    </Link>
  );
}

/** Baris jadwal tayang KOL (baca-saja, membuka KOL Hub). */
export function KolPostRow({ post }: { post: CalKolPost }) {
  return (
    <Link
      href={`/kol-hub/schedules/${post.id}`}
      className="hover:bg-muted/60 focus-visible:ring-ring group/link flex items-start gap-2 rounded-md px-1.5 py-1 outline-none focus-visible:ring-2"
    >
      <span className="flex w-5 shrink-0 justify-center pt-0.5">
        <AtSign className="text-muted-foreground size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm",
            post.posted && "text-muted-foreground",
          )}
        >
          {post.kolName}
        </span>
        <span className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
          <span className="tabular-nums">{post.time}</span>
          <span className="truncate">@{post.handle}</span>
          <span className="truncate">{post.campaignTitle}</span>
          {post.posted ? <span>Sudah tayang</span> : null}
          {post.tentative ? <span>Belum disetujui</span> : null}
        </span>
      </span>
      <ExternalLink
        className="text-muted-foreground/0 group-hover/link:text-muted-foreground mt-1 size-3 shrink-0"
        aria-hidden
      />
    </Link>
  );
}

/** Baris momen (libur, tanggal kembar, peringatan). */
export function MomentRow({ moment }: { moment: Moment }) {
  const holiday = moment.kind === "holiday";
  return (
    <div className="flex items-baseline gap-2 px-1.5 py-1 text-sm">
      <span className="flex w-5 shrink-0 justify-center self-center">
        {moment.kind === "season" ? (
          <Moon className="text-muted-foreground size-3.5" aria-hidden />
        ) : (
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              holiday ? "bg-red-600 dark:bg-red-400" : "bg-foreground/50",
            )}
          />
        )}
      </span>
      <span
        className={cn("min-w-0", holiday && "text-red-700 dark:text-red-400")}
      >
        {moment.label}
        {moment.endDate && moment.kind === "season"
          ? ` sampai ${formatDayShort(moment.endDate)}`
          : ""}
      </span>
      <span className="text-muted-foreground text-xs">
        {holiday ? "Libur nasional" : null}
        {moment.estimated ? (holiday ? ", perkiraan" : "Perkiraan") : null}
      </span>
    </div>
  );
}

/** Tombol segmen (dipakai pilihan tampilan dan zoom). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="bg-muted/60 inline-flex rounded-lg p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "focus-visible:ring-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
