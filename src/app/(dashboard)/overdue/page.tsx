import { TaskStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskToPhaseRef } from "@/lib/room-process-phase";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { taskLateDays, toJakartaDayKey } from "@/lib/task-effective-status";
import { OverdueClient, type OverdueTaskRow } from "./overdue-client";

/**
 * Jendela riwayat "diselesaikan terlambat" maksimum yang diambil (hari).
 * Rentang yang lebih pendek (hari ini, kemarin, 7/30/90 hari) disaring di klien.
 */
const COMPLETED_LATE_WINDOW_DAYS = 365;

const taskRowSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  completedAt: true,
  archivedAt: true,
  roomProcess: true,
  customProcessPhaseId: true,
  isApprovalRequired: true,
  isApproved: true,
  customProcessPhase: {
    select: { id: true, name: true, legacyProcessKey: true },
  },
  project: {
    select: {
      id: true,
      name: true,
      brand: { select: { name: true } },
      room: { select: { id: true, name: true } },
    },
  },
  assignees: { select: { user: { select: { id: true, name: true } } } },
} as const;

type TaskRowSource = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: OverdueTaskRow["priority"];
  dueDate: Date | null;
  completedAt: Date | null;
  archivedAt: Date | null;
  roomProcess: OverdueTaskRow["roomProcess"];
  customProcessPhaseId: string | null;
  isApprovalRequired: boolean;
  isApproved: boolean;
  customProcessPhase: {
    id: string;
    name: string;
    legacyProcessKey: OverdueTaskRow["roomProcess"] | null;
  } | null;
  project: {
    id: string;
    name: string;
    brand: { name: string } | null;
    room: { id: string; name: string };
  };
  assignees: { user: { id: string; name: string | null } }[];
};

function toRow(t: TaskRowSource, now: Date): OverdueTaskRow {
  const phase = taskToPhaseRef(t);
  const lateDays =
    t.status === TaskStatus.DONE && t.completedAt
      ? taskLateDays(t.dueDate, t.completedAt)
      : taskLateDays(t.dueDate, now);
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    roomProcess: t.roomProcess,
    dueDateIso: t.dueDate ? t.dueDate.toISOString() : null,
    completedAtIso: t.completedAt ? t.completedAt.toISOString() : null,
    archived: t.archivedAt != null,
    lateDays,
    completedAgoDays:
      t.status === TaskStatus.DONE && t.completedAt
        ? taskLateDays(t.completedAt, now)
        : null,
    needsApproval: t.isApprovalRequired && !t.isApproved,
    phaseLabel: phase.name,
    boardHref: `/room/${t.project.room.id}/tasks?process=${encodeURIComponent(phase.id)}`,
    room: { id: t.project.room.id, name: t.project.room.name },
    contextLabel: taskProjectContextLabel(t.project),
    assignees: t.assignees.map((a) => ({
      id: a.user.id,
      name: a.user.name ?? "Tanpa nama",
    })),
  };
}

export default async function CeoOverdueTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.CEO) redirect("/");

  const now = new Date();
  const since = new Date(now.getTime() - COMPLETED_LATE_WINDOW_DAYS * 86_400_000);

  const [overdueRaw, doneRaw] = await Promise.all([
    prisma.task.findMany({
      where: { status: TaskStatus.OVERDUE, archivedAt: null },
      select: taskRowSelect,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.task.findMany({
      where: {
        status: TaskStatus.DONE,
        completedAt: { gte: since },
        dueDate: { not: null },
      },
      select: taskRowSelect,
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const overdue = overdueRaw.map((t) => toRow(t, now));
  // "Selesai terlambat" = hari WIB penyelesaian lebih besar dari hari WIB tenggat.
  const completedLate = doneRaw
    .filter(
      (t) =>
        t.completedAt != null &&
        t.dueDate != null &&
        toJakartaDayKey(t.completedAt) > toJakartaDayKey(t.dueDate),
    )
    .map((t) => toRow(t, now));

  return (
    <OverdueClient overdue={overdue} completedLate={completedLate} />
  );
}
