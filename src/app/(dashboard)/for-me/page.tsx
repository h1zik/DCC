import Link from "next/link";
import { TaskStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  AlertOctagon,
  CircleDashed,
  ClipboardList,
  ListChecks,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roomTaskProcessLabel } from "@/lib/room-task-process";
import { taskStatusLabel } from "@/lib/task-status-ui";
import { Badge } from "@/components/ui/badge";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { cn } from "@/lib/utils";
import { MyTasksTaskCard } from "./my-tasks-task-card";

const FOR_ME_STATUSES: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.OVERDUE,
];

const STATUS_TONE: Record<
  TaskStatus,
  { dot: string; chip: string; ring: string; icon: typeof CircleDashed }
> = {
  [TaskStatus.TODO]: {
    dot: "bg-slate-400",
    chip: "border-slate-300/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    ring: "ring-slate-300/40",
    icon: CircleDashed,
  },
  [TaskStatus.IN_PROGRESS]: {
    dot: "bg-amber-500",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    ring: "ring-amber-300/40",
    icon: PlayCircle,
  },
  [TaskStatus.OVERDUE]: {
    dot: "bg-rose-500",
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    ring: "ring-rose-300/40",
    icon: AlertOctagon,
  },
  [TaskStatus.IN_REVIEW]: {
    dot: "bg-violet-500",
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    ring: "ring-violet-300/40",
    icon: CircleDashed,
  },
  [TaskStatus.DONE]: {
    dot: "bg-emerald-500",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-300/40",
    icon: CircleDashed,
  },
  [TaskStatus.BLOCKED]: {
    dot: "bg-muted-foreground",
    chip: "border-border bg-muted text-muted-foreground",
    ring: "ring-muted-foreground/30",
    icon: CircleDashed,
  },
};

function formatShortDate(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export default async function MyTasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [tasks, contentPlanningItems] = await Promise.all([
    prisma.task.findMany({
      where: {
        archivedAt: null,
        status: { in: FOR_ME_STATUSES },
        assignees: { some: { userId: session.user.id } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        roomProcess: true,
        checklistItems: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, title: true, done: true },
        },
        project: {
          select: {
            name: true,
            roomId: true,
            room: { select: { name: true, logoImage: true } },
          },
        },
      },
    }),
    prisma.roomContentPlanItem.findMany({
      where: {
        OR: [
          { picUserId: session.user.id },
          { picUserIds: { has: session.user.id } },
        ],
      },
      orderBy: [{ tanggalPosting: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        konten: true,
        jenisKonten: true,
        tanggalPosting: true,
        statusCopywriting: true,
        statusDesign: true,
        room: {
          select: {
            id: true,
            name: true,
            logoImage: true,
          },
        },
      },
    }),
  ]);

  const grouped = FOR_ME_STATUSES.map((status) => ({
    status,
    items: tasks
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      }),
  }));

  const totals = {
    todo: grouped.find((g) => g.status === TaskStatus.TODO)?.items.length ?? 0,
    progress:
      grouped.find((g) => g.status === TaskStatus.IN_PROGRESS)?.items.length ?? 0,
    overdue:
      grouped.find((g) => g.status === TaskStatus.OVERDUE)?.items.length ?? 0,
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHero
        icon={ListChecks}
        title="My Tasks"
        subtitle="Pekerjaan yang Anda pegang sebagai PIC. Klik kartu untuk langsung membuka ruangan terkait."
        right={
          <>
            <PageHeroChip>
              <CircleDashed className="size-3" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {totals.todo}
              </span>
              To-Do
            </PageHeroChip>
            <PageHeroChip>
              <PlayCircle className="size-3 text-amber-500" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {totals.progress}
              </span>
              Berjalan
            </PageHeroChip>
            <PageHeroChip>
              <AlertOctagon className="size-3 text-rose-500" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {totals.overdue}
              </span>
              Overdue
            </PageHeroChip>
            <PageHeroChip>
              <Sparkles className="size-3 text-violet-500" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {contentPlanningItems.length}
              </span>
              Content
            </PageHeroChip>
          </>
        }
      />

      <section
        aria-label="Tugas berdasarkan status"
        className="grid gap-3 md:grid-cols-3"
      >
        {grouped.map((group) => {
          const tone = STATUS_TONE[group.status];
          const Icon = tone.icon;
          return (
            <div
              key={group.status}
              className="border-border bg-card flex min-h-[260px] flex-col gap-3 rounded-xl border p-4 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full ring-2",
                    tone.dot,
                    tone.ring,
                  )}
                  aria-hidden
                />
                <h2 className="text-foreground inline-flex items-center gap-1.5 text-sm font-semibold">
                  <Icon className="size-3.5" aria-hidden />
                  {taskStatusLabel(group.status)}
                </h2>
                <span className="text-muted-foreground inline-flex items-center justify-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                  {group.items.length}
                </span>
              </div>
              {group.items.length === 0 ? (
                <p className="text-muted-foreground border-border/60 rounded-md border border-dashed py-6 text-center text-xs">
                  Tidak ada tugas.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {group.items.map((task) => (
                    <li key={task.id}>
                      <MyTasksTaskCard
                        href={`/room/${task.project.roomId}/tasks?process=${task.roomProcess}`}
                        title={task.title}
                        roomName={task.project.room.name}
                        processLabel={roomTaskProcessLabel(task.roomProcess)}
                        status={task.status}
                        statusChipClassName={tone.chip}
                        dueDateIso={
                          task.dueDate ? task.dueDate.toISOString() : null
                        }
                        checklistItems={task.checklistItems}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section aria-label="Content planning" className="space-y-3">
        <div className="flex items-center gap-2">
          <span
            className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            aria-hidden
          >
            <ClipboardList className="size-3" />
            Content Planning
          </span>
          <span className="text-muted-foreground text-xs">
            Item yang Anda pegang sebagai PIC
          </span>
        </div>

        {contentPlanningItems.length === 0 ? (
          <p className="border-border/60 bg-card text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
            Tidak ada item content planning.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {contentPlanningItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/room/${item.room.id}/content-planning`}
                  className="bg-card hover:border-primary/40 hover:shadow-md group flex h-full flex-col gap-2 rounded-xl border border-border p-3.5 shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.06em] uppercase">
                      {item.jenisKonten.replaceAll("_", " ")}
                    </span>
                    <span className="bg-border h-px flex-1" aria-hidden />
                    <span className="text-muted-foreground text-[10px]">
                      {item.tanggalPosting
                        ? formatShortDate(item.tanggalPosting)
                        : "TBD"}
                    </span>
                  </div>
                  <p className="text-foreground line-clamp-2 text-sm font-medium leading-snug">
                    {item.konten || "(Tanpa judul konten)"}
                  </p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {item.room.name}
                  </p>
                  <div className="border-border/60 mt-auto flex flex-wrap items-center gap-1.5 border-t pt-2">
                    <Badge variant="outline" className="text-[10px]">
                      CW: {item.statusCopywriting.replaceAll("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Design: {item.statusDesign.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
