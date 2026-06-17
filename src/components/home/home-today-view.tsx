"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ArrowRight,
  CalendarDays,
  Focus,
  GitBranch,
  LayoutGrid,
  ListChecks,
  MessageCircle,
  ScanFace,
  Sparkles,
} from "lucide-react";
import { markNotificationRead } from "@/actions/notifications";
import { MyTasksTaskCard } from "@/app/(dashboard)/for-me/my-tasks-task-card";
import { Button } from "@/components/ui/button";
import type { HomeTodayData } from "@/lib/home/get-home-data";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<TaskStatus, { chip: string }> = {
  [TaskStatus.TODO]: {
    chip: "border-slate-300/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  [TaskStatus.IN_PROGRESS]: {
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  [TaskStatus.OVERDUE]: {
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  [TaskStatus.IN_REVIEW]: {
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  [TaskStatus.DONE]: {
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  [TaskStatus.BLOCKED]: {
    chip: "border-border bg-muted text-muted-foreground",
  },
};

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
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

function SectionHeader({
  title,
  href,
  linkLabel = "Lihat semua",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-foreground text-sm font-semibold tracking-tight">
        {title}
      </h2>
      {href ? (
        <Link
          href={href}
          className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
        >
          {linkLabel}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function HomeTodayView({ data }: { data: HomeTodayData }) {
  const router = useRouter();

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
    <div className="flex w-full min-w-0 flex-col gap-8 pb-8 animate-in fade-in duration-500">
      <header className="space-y-1.5 pt-1">
        <p className="text-muted-foreground text-sm">
          {timeGreeting()}, {data.displayName}
        </p>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
          {data.hasAnyAttention
            ? "Berikut yang perlu fokus hari ini."
            : "Hari ini tenang — lanjutkan dari ruangan favoritmu."}
        </h1>
      </header>

      <div className="grid w-full items-start gap-8 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <SectionHeader title="Perlu perhatian" href="/for-me" />
          {data.focusTasks.length === 0 &&
          data.notifications.length === 0 &&
          data.pendingPipeline.length === 0 ? (
            <div className="border-border/60 bg-muted/20 flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-10 text-center">
              <Sparkles className="text-primary/50 size-8" aria-hidden />
              <p className="text-foreground text-sm font-medium">
                Tidak ada yang mendesak
              </p>
              <p className="text-muted-foreground text-xs">
                Semua tugas dan notifikasi sudah tertangani — atau belum ada yang
                masuk.
              </p>
            </div>
          ) : (
            <ul className="grid gap-2 xl:grid-cols-2">
              {data.focusTasks.map((task) => (
                <li key={task.id} className="min-w-0">
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
              {data.notifications.map((n) => (
                <li key={n.id} className="min-w-0 xl:col-span-2">
                  <button
                    type="button"
                    className={cn(
                      "border-border/70 bg-card hover:bg-muted/40 w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                      !n.isRead && "border-primary/25 bg-primary/5",
                    )}
                    onClick={() =>
                      void onNotificationClick(n.id, n.isRead, n.href)
                    }
                  >
                    <p className="text-foreground line-clamp-2 text-sm leading-snug">
                      {n.message}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: idLocale,
                      })}
                    </p>
                  </button>
                </li>
              ))}
              {data.pendingPipeline.map((p) => (
                <li key={p.id} className="min-w-0 xl:col-span-2">
                  <Link
                    href="/projects"
                    className="border-border/70 bg-card hover:bg-muted/40 flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 transition-colors"
                  >
                    <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
                      <GitBranch className="size-3" aria-hidden />
                      Pipeline menunggu
                    </span>
                    <span className="text-foreground text-sm font-medium">
                      {p.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {p.brandName ?? p.roomName}
                      {p.pendingStageLabel
                        ? ` · menunggu ${p.pendingStageLabel}`
                        : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeader title="Hari ini" href="/schedule" />
          {data.todayEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Tidak ada jadwal lagi hari ini.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.todayEvents.map((event) => (
                <li key={event.id}>
                  <Link
                    href="/schedule"
                    className="border-border/70 bg-card hover:bg-muted/40 flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors"
                  >
                    <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums">
                      {formatEventTime(event.startsAt)}
                    </span>
                    <span className="min-w-0">
                      <p className="text-foreground line-clamp-1 text-sm font-medium">
                        {event.title}
                      </p>
                      {event.location ? (
                        <p className="text-muted-foreground line-clamp-1 text-xs">
                          {event.location}
                        </p>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <SectionHeader title="Lanjutkan" href="/tasks" linkLabel="Semua ruangan" />
        {data.continueRooms.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Belum ada ruangan — buka Workspaces untuk memilih ruangan kerja.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
            {data.continueRooms.map((room) => (
              <Link
                key={room.id}
                href={`/room/${room.id}/tasks`}
                className="border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30 flex min-w-0 flex-col gap-2 rounded-xl border p-3 transition-colors"
              >
                <span
                  className={cn(
                    "relative flex size-10 items-center justify-center overflow-hidden rounded-lg text-[11px] font-bold uppercase",
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
                    <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[9px] font-semibold">
                      {room.unreadChatCount > 9 ? "9+" : room.unreadChatCount}
                    </span>
                  ) : null}
                </span>
                <span className="text-foreground line-clamp-2 text-xs font-medium leading-snug">
                  {room.name}
                </span>
                <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                  {room.unreadChatCount > 0 ? (
                    <>
                      <MessageCircle className="size-3" aria-hidden />
                      {room.unreadChatCount} chat
                    </>
                  ) : (
                    <>
                      <ListChecks className="size-3" aria-hidden />
                      {room.openTaskCount} aktif
                    </>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-wrap gap-2 border-t border-border/50 pt-6">
        <Button
          type="button"
          size="sm"
          nativeButton={false}
          render={<Link href="/tasks" />}
        >
          <LayoutGrid className="size-3.5" aria-hidden />
          Workspaces
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/for-me" />}
        >
          <Focus className="size-3.5" aria-hidden />
          My Work
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/schedule" />}
        >
          <CalendarDays className="size-3.5" aria-hidden />
          Schedule
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/attendance" />}
        >
          <ScanFace className="size-3.5" aria-hidden />
          Attendance
        </Button>
      </section>
    </div>
  );
}
