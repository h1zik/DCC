import Link from "next/link";
import { TaskStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roomTaskProcessLabel } from "@/lib/room-task-process";
import { taskStatusLabel } from "@/lib/task-status-ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FOR_ME_STATUSES: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.OVERDUE,
];

function taskStatusOrder(status: TaskStatus): number {
  return FOR_ME_STATUSES.indexOf(status);
}

export default async function ForMePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tasks = await prisma.task.findMany({
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
      project: {
        select: {
          name: true,
          roomId: true,
          room: { select: { name: true } },
        },
      },
    },
  });

  const grouped = FOR_ME_STATUSES.map((status) => ({
    status,
    items: tasks
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      }),
  })).sort((a, b) => taskStatusOrder(a.status) - taskStatusOrder(b.status));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">For Me</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Shortcut tugas yang Anda pegang sebagai PIC (To-Do, Berjalan, Overdue).
          Klik tugas untuk langsung ke ruangan/proses terkait.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {grouped.map((group) => (
          <Card key={group.status} className="min-h-[260px]">
            <CardHeader>
              <CardTitle className="text-base">{taskStatusLabel(group.status)}</CardTitle>
              <CardDescription>{group.items.length} tugas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.items.length === 0 ? (
                <p className="text-muted-foreground text-sm">Tidak ada tugas.</p>
              ) : (
                group.items.map((task) => (
                  <Link
                    key={task.id}
                    href={`/room/${task.project.roomId}/tasks?process=${task.roomProcess}`}
                    className="hover:bg-muted/50 block rounded-md border border-border px-3 py-2 transition-colors"
                  >
                    <p className="font-medium leading-snug">{task.title}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {task.project.room.name} · {roomTaskProcessLabel(task.roomProcess)}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {taskStatusLabel(task.status)}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {task.dueDate
                          ? `Due ${task.dueDate.toLocaleDateString("id-ID")}`
                          : "Tanpa deadline"}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
