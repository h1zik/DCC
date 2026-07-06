"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskStatus } from "@prisma/client";
import { formatDistanceToNow, isToday, isPast } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coffee,
  Focus,
  GitBranch,
  ListChecks,
  MessageCircle,
  Moon,
  Sparkles,
  Sun,
  Sunset,
} from "lucide-react";
import { markNotificationRead } from "@/actions/notifications";
import { MyTasksTaskCard } from "@/app/(dashboard)/for-me/my-tasks-task-card";
import type { HomeTodayData } from "@/lib/home/get-home-data";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<TaskStatus, { chip: string; dot: string }> = {
  [TaskStatus.TODO]: {
    chip: "border-slate-300/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  [TaskStatus.IN_PROGRESS]: {
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  [TaskStatus.OVERDUE]: {
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  [TaskStatus.IN_REVIEW]: {
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  [TaskStatus.DONE]: {
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  [TaskStatus.BLOCKED]: {
    chip: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

function timeGreeting(): { label: string; icon: React.ReactNode } {
  const h = new Date().getHours();
  if (h < 11) return { label: "Selamat pagi", icon: <Sun className="size-4" /> };
  if (h < 15) return { label: "Selamat siang", icon: <Coffee className="size-4" /> };
  if (h < 18) return { label: "Selamat sore", icon: <Sunset className="size-4" /> };
  return { label: "Selamat malam", icon: <Moon className="size-4" /> };
}

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roomInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/u).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function stagger(delay: number) {
  return `motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out motion-safe:fill-mode-both motion-safe:[animation-delay:${delay}ms] motion-reduce:animate-none`;
}

function CountUpNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    if (reduceMotion || value <= 0) {
      frame = requestAnimationFrame(() => setDisplayValue(value));
      return () => cancelAnimationFrame(frame);
    }

    const duration = 360;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{displayValue}</>;
}

function SectionHeader({
  title,
  icon,
  href,
  linkLabel = "Lihat semua",
  count,
}: {
  title: string;
  icon?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
        {icon ? (
          <span className="rounded-lg bg-muted/60 p-1.5 text-muted-foreground ring-1 ring-border/60 [&>svg]:size-4">
            {icon}
          </span>
        ) : null}
        {title}
        {typeof count === "number" && count > 0 ? (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
            {count}
          </span>
        ) : null}
      </h2>
      {href ? (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary outline-none transition-colors duration-150 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {linkLabel}
          <ArrowRight
            className="size-3.5 transition-transform duration-150 motion-safe:group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      ) : null}
    </div>
  );
}

export function HomeTodayView({ data }: { data: HomeTodayData }) {
  const router = useRouter();
  const greeting = timeGreeting();
  const today = new Date();
  const todayDateLabel = today.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const attentionCount =
    data.focusTasks.length +
    data.notifications.length +
    data.pendingPipeline.length;

  async function onNotificationClick(
    id: string,
    isRead: boolean,
    href: string,
  ) {
    if (!isRead) {
      await markNotificationRead(id);
      router.refresh();
    }
    router.push(href);
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 pb-8 sm:gap-7">
      <header
        className={cn(
          "relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-sm sm:p-6 lg:p-7",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300 motion-safe:ease-out motion-safe:fill-mode-both motion-reduce:animate-none",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-accent/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-12 size-44 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-background/50 px-2.5 py-1 text-sm text-muted-foreground ring-1 ring-border/60 backdrop-blur">
              <span className="text-accent-foreground [&>svg]:size-4">
                {greeting.icon}
              </span>
              {greeting.label},{" "}
              <span className="font-medium text-foreground">
                {data.displayName}
              </span>
            </p>
            <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-[2.55rem] lg:leading-tight">
              {data.hasAnyAttention
                ? "Berikut yang perlu fokus hari ini."
                : "Hari ini tenang — lanjutkan dari ruangan favoritmu."}
            </h1>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden />
              {todayDateLabel}
            </p>
          </div>

          <div className="grid shrink-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap lg:justify-end">
            <StatPill
              icon={<ListChecks className="size-3.5" />}
              label="Tugas aktif"
              value={data.focusTasks.length}
              tone={data.focusTasks.length > 0 ? "accent" : "neutral"}
              delay={80}
            />
            <StatPill
              icon={<Bell className="size-3.5" />}
              label="Notifikasi"
              value={data.notifications.length}
              tone={data.notifications.length > 0 ? "warning" : "neutral"}
              delay={120}
            />
            <StatPill
              icon={<CalendarDays className="size-3.5" />}
              label="Jadwal hari ini"
              value={data.todayEvents.length}
              tone="neutral"
              delay={160}
            />
          </div>
        </div>
      </header>

      <div className="grid w-full items-start gap-5 lg:grid-cols-3 lg:gap-6">
        <section className={cn("space-y-3 lg:col-span-2", stagger(80))}>
          <SectionHeader
            title="Perlu perhatian"
            icon={<Focus />}
            href="/for-me"
            linkLabel="Buka My Work"
            count={attentionCount}
          />
          {data.focusTasks.length === 0 &&
          data.notifications.length === 0 &&
          data.pendingPipeline.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-12 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 motion-safe:ease-out motion-reduce:animate-none">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
                <CheckCircle2 className="size-6" aria-hidden />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Tidak ada yang mendesak
                </p>
                <p className="max-w-md text-xs text-muted-foreground">
                  Semua tugas dan notifikasi sudah tertangani — atau belum ada yang
                  masuk.
                </p>
              </div>
            </div>
          ) : (
            <ul className="grid gap-3 xl:grid-cols-2">
              {data.focusTasks.map((task, i) => (
                <li
                  key={task.id}
                  className={cn("min-w-0", stagger(120 + i * 40))}
                >
                  <MyTasksTaskCard
                    href={`/room/${task.roomId}/tasks?process=${task.roomProcess}`}
                    title={task.title}
                    roomName={task.roomName}
                    processLabel={task.processLabel}
                    status={task.status}
                    statusChipClassName={
                      STATUS_TONE[task.status]?.chip ??
                      STATUS_TONE[TaskStatus.TODO].chip
                    }
                    dueDateIso={task.dueDate}
                    checklistItems={task.checklistItems}
                  />
                </li>
              ))}

              {data.notifications.map((n, i) => (
                <li
                  key={n.id}
                  className={cn(
                    "min-w-0 xl:col-span-2",
                    stagger(120 + data.focusTasks.length * 40 + i * 40),
                  )}
                >
                  <button
                    type="button"
                    className={cn(
                      "group flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left outline-none transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring/40 motion-safe:hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                      !n.isRead
                        ? "border-primary/30 bg-primary/5 shadow-sm hover:border-primary/45 hover:bg-primary/10"
                        : "border-border/70 bg-card hover:border-primary/25 hover:bg-muted/35 hover:shadow-sm",
                    )}
                    onClick={() =>
                      void onNotificationClick(n.id, n.isRead, n.href)
                    }
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1",
                        !n.isRead
                          ? "bg-primary/10 text-primary ring-primary/20"
                          : "bg-muted text-muted-foreground ring-border/60",
                      )}
                    >
                      <Bell className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm leading-snug text-foreground">
                        {n.message}
                      </p>
                      <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" aria-hidden />
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                          locale: idLocale,
                        })}
                      </p>
                    </span>
                    {!n.isRead ? (
                      <span
                        aria-hidden
                        className="mt-2 size-2 shrink-0 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
                      />
                    ) : null}
                  </button>
                </li>
              ))}

              {data.pendingPipeline.map((p, i) => (
                <li
                  key={p.id}
                  className={cn(
                    "min-w-0 xl:col-span-2",
                    stagger(
                      120 +
                        (data.focusTasks.length + data.notifications.length) *
                          40 +
                        i * 40,
                    ),
                  )}
                >
                  <Link
                    href="/projects"
                    className="group flex items-start gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 outline-none transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-accent/45 hover:bg-accent/5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/40 motion-safe:hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-foreground ring-1 ring-accent/20">
                      <GitBranch className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Pipeline menunggu
                      </span>
                      <span className="mt-0.5 block line-clamp-1 text-sm font-medium text-foreground">
                        {p.name}
                      </span>
                      <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">
                        {p.brandName ?? p.roomName}
                        {p.pendingStageLabel
                          ? ` · menunggu ${p.pendingStageLabel}`
                          : ""}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-safe:group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cn("space-y-3", stagger(150))}>
          <SectionHeader
            title="Hari ini"
            icon={<CalendarDays />}
            href="/schedule"
            count={data.todayEvents.length}
          />
          {data.todayEvents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border/60">
                <CalendarDays className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-medium text-foreground">
                Tidak ada jadwal lagi
              </p>
              <p className="text-xs text-muted-foreground">
                Nikmati waktu luangmu.
              </p>
            </div>
          ) : (
            <ol className="relative flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[1.15rem] before:w-px before:bg-gradient-to-b before:from-border/20 before:via-border/70 before:to-border/20">
              {data.todayEvents.map((event, i) => {
                const eventDate = new Date(event.startsAt);
                const past = isPast(eventDate) && !isToday(eventDate);
                return (
                  <li
                    key={event.id}
                    className={cn("relative pl-12", stagger(190 + i * 50))}
                  >
                    <span
                      className={cn(
                        "absolute top-1.5 left-0 flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold tabular-nums ring-1",
                        past
                          ? "bg-muted text-muted-foreground ring-border/60"
                          : "bg-primary/10 text-primary ring-primary/20",
                      )}
                    >
                      {formatEventTime(event.startsAt)}
                    </span>
                    <Link
                      href="/schedule"
                      className={cn(
                        "group flex flex-col gap-0.5 rounded-2xl border px-3.5 py-3 outline-none transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring/40 motion-safe:hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                        past
                          ? "border-border/50 bg-muted/20"
                          : "border-border/70 bg-card hover:border-primary/35 hover:bg-primary/5 hover:shadow-sm",
                      )}
                    >
                      <p
                        className={cn(
                          "line-clamp-1 text-sm font-medium",
                          past ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {event.title}
                      </p>
                      {event.location ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {event.location}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <section className={cn("space-y-3", stagger(230))}>
        <SectionHeader
          title="Lanjutkan"
          icon={<Sparkles />}
          href="/tasks"
          linkLabel="Semua ruangan"
          count={data.continueRooms.length}
        />
        {data.continueRooms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border/60">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-foreground">
              Belum ada ruangan
            </p>
            <p className="text-xs text-muted-foreground">
              Buka Workspaces untuk memilih ruangan kerja.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {data.continueRooms.map((room, i) => (
              <Link
                key={room.id}
                href={`/room/${room.id}/tasks`}
                className={cn(
                  "group flex min-w-0 flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3.5 outline-none transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-primary/35 hover:bg-primary/5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/40 motion-safe:hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                  stagger(270 + i * 40),
                )}
              >
                <span
                  className={cn(
                    "relative flex size-12 items-center justify-center overflow-hidden rounded-2xl text-xs font-bold uppercase shadow-sm ring-1 ring-border/60 transition-transform duration-150 motion-safe:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100",
                    room.logoImage ? "bg-muted" : "text-white",
                  )}
                  style={
                    room.logoImage
                      ? undefined
                      : {
                          backgroundColor:
                            room.brandColor ?? "var(--primary)",
                        }
                  }
                >
                  {room.logoImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={room.logoImage}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    roomInitials(room.name)
                  )}
                  {room.unreadChatCount > 0 ? (
                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground ring-2 ring-card">
                      {room.unreadChatCount > 9 ? "9+" : room.unreadChatCount}
                    </span>
                  ) : null}
                </span>
                <span className="line-clamp-2 min-h-[2rem] text-xs font-semibold leading-snug text-foreground">
                  {room.name}
                </span>
                <span
                  className={cn(
                    "mt-auto inline-flex items-center gap-1 rounded-full text-[10px] font-medium",
                    room.unreadChatCount > 0
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {room.unreadChatCount > 0 ? (
                    <>
                      <MessageCircle className="size-3" aria-hidden />
                      {room.unreadChatCount} chat baru
                    </>
                  ) : (
                    <>
                      <ListChecks className="size-3" aria-hidden />
                      {room.openTaskCount} tugas aktif
                    </>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  tone = "neutral",
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "neutral" | "accent" | "warning";
  delay?: number;
}) {
  const toneClass = {
    neutral: "border-border/60 bg-background/55 text-muted-foreground",
    accent: "border-accent/25 bg-accent/15 text-accent-foreground",
    warning: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium shadow-sm backdrop-blur",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-safe:ease-out motion-safe:fill-mode-both motion-reduce:animate-none",
        toneClass,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="rounded-lg bg-background/55 p-1 ring-1 ring-border/50 [&>svg]:size-3.5">
        {icon}
      </span>
      <span className="font-semibold tabular-nums text-foreground">
        <CountUpNumber value={value} />
      </span>
      <span className="text-muted-foreground/85">{label}</span>
    </span>
  );
}
