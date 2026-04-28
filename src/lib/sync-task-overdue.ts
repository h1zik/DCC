import { NotificationType, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { notifyPicTaskOverdueViaWhatsApp } from "@/lib/task-whatsapp-notify";

const JAKARTA_TZ = "Asia/Jakarta";

function toJakartaDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/** Menandai tugas lewat tenggat sebagai OVERDUE dan mengirim notifikasi ke PIC. */
export async function syncOverdueTasks() {
  const now = new Date();
  const todayJakarta = toJakartaDayKey(now);
  const candidates = await prisma.task.findMany({
    where: {
      status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      dueDate: { not: null },
      archivedAt: null,
    },
    select: {
      id: true,
      dueDate: true,
      assignees: {
        select: { userId: true, user: { select: { name: true, whatsappPhone: true } } },
      },
      title: true,
      project: { include: { brand: true, room: { select: { name: true } } } },
    },
  });
  const overdueCandidates = candidates.filter((c) => {
    if (!c.dueDate) return false;
    // Aturan bisnis: due 27 Apr baru overdue saat sudah masuk 28 Apr (WIB).
    return toJakartaDayKey(c.dueDate) < todayJakarta;
  });
  if (overdueCandidates.length === 0) return;

  const ids = overdueCandidates.map((c) => c.id);
  await prisma.task.updateMany({
    where: { id: { in: ids } },
    data: { status: TaskStatus.OVERDUE },
  });

  await Promise.all(
    overdueCandidates
      .flatMap((c) => c.assignees.map((a) => ({ userId: a.userId, c })))
      .map(({ userId, c }) =>
        notifyUser(
          userId,
          `Tugas overdue: ${c.title} (${taskProjectContextLabel(c.project)})`,
          NotificationType.TASK_OVERDUE,
        ),
      ),
  );

  await Promise.all(
    overdueCandidates.flatMap((c) =>
      c.assignees.map((a) =>
        notifyPicTaskOverdueViaWhatsApp({
          assignee: a.user,
          taskTitle: c.title,
          project: c.project,
        }),
      ),
    ),
  );
}
