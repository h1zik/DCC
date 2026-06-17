import Link from "next/link";
import { TaskStatus } from "@prisma/client";
import {
  AlertOctagon,
  ArrowRight,
  Bell,
  CalendarDays,
  CircleDashed,
  Clock,
  DoorOpen,
  GitBranch,
  Inbox,
  LayoutGrid,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { MyTasksTaskCard } from "@/app/(dashboard)/for-me/my-tasks-task-card";
import { DashboardNotificationsCard } from "@/components/workspace-dashboard/dashboard-notifications-card";
import { taskStatusLabel } from "@/lib/task-status-ui";
import type { WorkspaceDashboardData } from "@/lib/workspace-dashboard/get-dashboard-data";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<
  TaskStatus,
  { chip: string }
> = {
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

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  accent = false,
}: {
  icon: typeof ListChecks;
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <Card
      className={cn(
        "transition-colors",
        href && "hover:border-primary/40 hover:bg-muted/20",
        accent && value !== 0 && value !== "0" && "border-rose-500/30",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium">
          {label}
        </CardTitle>
        <Icon
          className={cn(
            "size-4",
            accent && value !== 0 && value !== "0"
              ? "text-rose-500"
              : "text-muted-foreground",
          )}
          aria-hidden
        />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? (
          <CardDescription className="mt-1 text-xs">{hint}</CardDescription>
        ) : null}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function OperationsCommandCenter({
  data,
}: {
  data: WorkspaceDashboardData;
}) {
  const { kpis } = data;

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHero
        icon={LayoutGrid}
        title="Ringkasan operasional"
        subtitle="Pantau tugas, deadline, dan aktivitas ruangan sebelum masuk Kanban."
        right={
          <>
            <PageHeroChip>
              <DoorOpen className="size-3" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {data.roomCount}
              </span>
              ruangan
            </PageHeroChip>
            {data.highlights[0] ? (
              <PageHeroChip>
                <span className="text-foreground/90">{data.highlights[0]}</span>
              </PageHeroChip>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          nativeButton={false}
          render={<Link href="/tasks" />}
        >
          <LayoutGrid className="size-3.5" aria-hidden />
          Tugas & Kanban
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/for-me" />}
        >
          <ListChecks className="size-3.5" aria-hidden />
          My Tasks
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/schedule" />}
        >
          <CalendarDays className="size-3.5" aria-hidden />
          Jadwal
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={ListChecks}
          label="Tugas saya aktif"
          value={kpis.myActiveTasks}
          hint="To-Do, berjalan, overdue"
          href="/for-me"
        />
        <KpiCard
          icon={AlertOctagon}
          label="Overdue ruangan"
          value={kpis.totalOverdue}
          hint="Di ruangan yang bisa Anda akses"
          href="/tasks"
          accent={kpis.totalOverdue > 0}
        />
        <KpiCard
          icon={CircleDashed}
          label="Tertunda / blocked"
          value={kpis.blockedCount}
          hint="Menunggu pihak lain"
          href="/tasks"
        />
        <KpiCard
          icon={Bell}
          label="Notifikasi belum dibaca"
          value={kpis.unreadNotifications}
          hint={
            data.canViewPipeline && kpis.pendingPipeline > 0
              ? `${kpis.pendingPipeline} pipeline menunggu`
              : "Tugas, jadwal, pembaruan"
          }
          accent={kpis.unreadNotifications > 0}
        />
      </section>

      <div className="grid items-stretch gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="text-primary size-4" aria-hidden />
                Tugas saya
              </CardTitle>
              <Link
                href="/for-me"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                Lihat semua
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent>
              {data.myTasks.length === 0 ? (
                <EmptyBlock
                  icon={Inbox}
                  title="Belum ada tugas aktif"
                  description="Tugas yang ditugaskan ke Anda sebagai PIC akan muncul di sini."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.myTasks.map((task) => (
                    <li key={task.id}>
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
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex lg:col-span-2 lg:row-span-2">
          <Card className="flex h-full w-full flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DoorOpen className="text-primary size-4" aria-hidden />
                Ringkasan ruangan
              </CardTitle>
              <Link
                href="/tasks"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                Buka semua
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              {data.rooms.length === 0 ? (
                <EmptyBlock
                  icon={DoorOpen}
                  title="Belum ada ruangan"
                  description="Hubungi administrator agar ditambahkan ke ruangan kerja."
                  className="flex-1 justify-center"
                />
              ) : (
                <ul className="divide-border/60 -my-1 divide-y">
                  {data.rooms.map((room) => (
                    <li key={room.roomId}>
                      <Link
                        href={`/room/${room.roomId}/tasks`}
                        className="hover:bg-muted/50 -mx-2 flex flex-col gap-1 rounded-lg px-2 py-2.5 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-foreground line-clamp-1 text-sm font-medium">
                            {room.roomName}
                          </p>
                          <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                            {room.totalActive} aktif
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {room.brandName ?? "Tanpa brand"}
                          {room.overdue > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400">
                              {" "}
                              · {room.overdue} overdue
                            </span>
                          ) : null}
                          {room.myTasks > 0 ? (
                            <span className="text-foreground/80">
                              {" "}
                              · {room.myTasks} tugas saya
                            </span>
                          ) : null}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex lg:col-span-3">
          <Card className="flex h-full w-full flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="text-amber-500 size-4" aria-hidden />
                Deadline 7 hari ke depan
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              {data.deadlines.length === 0 ? (
                <EmptyBlock
                  icon={CalendarDays}
                  title="Tidak ada deadline mendekat"
                  description="Tugas dengan due date minggu ini akan tampil di sini."
                  className="flex-1 justify-center"
                />
              ) : (
                <ul className="divide-border/60 -my-1 divide-y">
                  {data.deadlines.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/room/${d.roomId}/tasks`}
                        className="hover:bg-muted/50 -mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-foreground line-clamp-1 text-sm font-medium">
                            {d.title}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {d.roomName} · {taskStatusLabel(d.status)}
                          </p>
                        </div>
                        <span className="text-foreground shrink-0 text-xs font-medium tabular-nums">
                          {formatShortDate(d.dueDate)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex lg:col-span-3">
          <DashboardNotificationsCard
            className="w-full"
            notifications={data.notifications}
            unreadCount={kpis.unreadNotifications}
          />
        </div>

        {data.canViewPipeline ? (
          <div className="flex lg:col-span-2">
            <Card className="flex h-full w-full flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GitBranch className="text-primary size-4" aria-hidden />
                  Pipeline menunggu
                </CardTitle>
                <Link
                  href="/projects"
                  className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  Pipeline
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                {data.pendingPipeline.length === 0 ? (
                  <EmptyBlock
                    icon={GitBranch}
                    title="Tidak ada pipeline menunggu"
                    description="Tidak ada proyek yang menunggu persetujuan tahap."
                    className="flex-1 justify-center"
                  />
                ) : (
                  <ul className="divide-border/60 -my-1 divide-y">
                    {data.pendingPipeline.map((p) => (
                      <li key={p.id}>
                        <Link
                          href="/projects"
                          className="hover:bg-muted/50 -mx-2 flex flex-col gap-0.5 rounded-lg px-2 py-2.5 transition-colors"
                        >
                          <p className="text-foreground line-clamp-1 text-sm font-medium">
                            {p.name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {p.brandName ?? p.roomName}
                            {p.pendingStageLabel
                              ? ` · menunggu ${p.pendingStageLabel}`
                              : ""}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyBlock({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-col items-center gap-2 py-8 text-center",
        className,
      )}
    >
      <Icon className="size-8 opacity-40" aria-hidden />
      <p className="text-foreground text-sm font-medium">{title}</p>
      <p className="text-xs">{description}</p>
    </div>
  );
}
