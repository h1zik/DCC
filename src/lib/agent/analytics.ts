import { TaskStatus } from "@prisma/client";
import { getInventoryAlerts } from "@/lib/ai-api/queries";
import type { AiApiRole } from "@/lib/ai-api/auth";
import { canViewInventory } from "@/lib/ai-api/auth";
import { taskStatusLabel } from "@/lib/task-status-ui";
import { prisma } from "@/lib/prisma";
import { assertAgentRoomAccess } from "./access";
import {
  findAgentTasksForMove,
  listAgentRooms,
  listAgentTasks,
  resolveAgentRoom,
} from "./queries";
import type { AgentUser } from "./types";

function userRoleToAiRole(role: string): AiApiRole {
  const r = role.toUpperCase();
  if (
    r === "CEO" ||
    r === "ADMINISTRATOR" ||
    r === "LOGISTICS" ||
    r === "FINANCE" ||
    r === "STUDIO" ||
    r === "ALL"
  ) {
    return r as AiApiRole;
  }
  return "STUDIO";
}

export async function listMyAgentTasks(
  user: AgentUser,
  params?: { status?: TaskStatus; limit?: number },
) {
  const tasks = await listAgentTasks(user, {
    assignedToMe: true,
    status: params?.status,
    limit: params?.limit ?? 40,
  });

  const byStatus: Record<string, number> = {};
  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  }

  return { total: tasks.length, byStatus, tasks };
}

export async function analyzeRoomWorkload(
  user: AgentUser,
  roomNameOrId: string,
) {
  const room = await resolveAgentRoom(user, roomNameOrId);
  const tasks = await listAgentTasks(user, { roomId: room.id, limit: 50 });

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const byStatus: Record<string, { count: number; label: string }> = {};
  let overdue = 0;
  let dueThisWeek = 0;
  let myTasks = 0;
  let blocked = 0;

  for (const t of tasks) {
    const label = taskStatusLabel(t.status);
    if (!byStatus[t.status]) {
      byStatus[t.status] = { count: 0, label };
    }
    byStatus[t.status]!.count += 1;

    if (t.status === TaskStatus.OVERDUE) overdue += 1;
    if (t.status === TaskStatus.BLOCKED) blocked += 1;
    if (t.isAssignedToMe) myTasks += 1;
    if (t.dueDate) {
      const due = new Date(t.dueDate);
      if (due >= now && due <= weekEnd) dueThisWeek += 1;
    }
  }

  const topOverdue = tasks
    .filter((t) => t.status === TaskStatus.OVERDUE)
    .slice(0, 5)
    .map((t) => ({
      title: t.title,
      phaseName: t.phaseName,
      assignees: t.assignees,
      dueDate: t.dueDate,
    }));

  const insights: string[] = [];
  if (overdue > 0) {
    insights.push(`${overdue} tugas overdue — perlu prioritas segera.`);
  }
  if (blocked > 0) {
    insights.push(`${blocked} tugas diblokir — cek hambatan.`);
  }
  if (dueThisWeek > 0) {
    insights.push(`${dueThisWeek} tugas deadline minggu ini.`);
  }
  if (myTasks > 0) {
    insights.push(`${myTasks} tugas ditugaskan ke kamu di ruangan ini.`);
  }

  return {
    roomId: room.id,
    roomName: room.name,
    totalActive: tasks.length,
    byStatus: Object.values(byStatus),
    overdueCount: overdue,
    blockedCount: blocked,
    dueThisWeekCount: dueThisWeek,
    myTasksCount: myTasks,
    topOverdue,
    insights,
  };
}

export async function getUpcomingDeadlines(
  user: AgentUser,
  params?: { daysAhead?: number; roomNameOrId?: string; limit?: number },
) {
  const days = Math.min(params?.daysAhead ?? 14, 30);
  const limit = Math.min(params?.limit ?? 25, 50);
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  let roomId: string | undefined;
  if (params?.roomNameOrId?.trim()) {
    const room = await resolveAgentRoom(user, params.roomNameOrId);
    roomId = room.id;
  }

  const tasks = await listAgentTasks(user, { roomId, limit: 50 });

  const upcoming = tasks
    .filter((t) => {
      if (!t.dueDate || t.status === TaskStatus.DONE) return false;
      const due = new Date(t.dueDate);
      return due >= now && due <= end;
    })
    .sort(
      (a, b) =>
        new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
    )
    .slice(0, limit);

  return { daysAhead: days, count: upcoming.length, tasks: upcoming };
}

export async function summarizeUserWorkspaces(user: AgentUser) {
  const rooms = await listAgentRooms(user);
  const summaries = [];

  for (const room of rooms.slice(0, 12)) {
    const tasks = await listAgentTasks(user, { roomId: room.id, limit: 50 });
    const overdue = tasks.filter((t) => t.status === TaskStatus.OVERDUE).length;
    const inProgress = tasks.filter(
      (t) => t.status === TaskStatus.IN_PROGRESS,
    ).length;
    const myTasks = tasks.filter((t) => t.isAssignedToMe).length;

    summaries.push({
      roomId: room.id,
      roomName: room.name,
      brandName: room.brandName,
      totalActive: tasks.length,
      overdue,
      inProgress,
      myTasks,
    });
  }

  const totalOverdue = summaries.reduce((s, r) => s + r.overdue, 0);
  const totalMyTasks = summaries.reduce((s, r) => s + r.myTasks, 0);

  return {
    roomCount: rooms.length,
    totalOverdue,
    totalMyTasks,
    rooms: summaries,
    highlights: [
      ...(totalOverdue > 0
        ? [`${totalOverdue} tugas overdue di seluruh ruangan.`]
        : ["Tidak ada tugas overdue saat ini."]),
      ...(totalMyTasks > 0
        ? [`Kamu punya ${totalMyTasks} tugas aktif.`]
        : []),
    ],
  };
}

export async function getAgentTaskCommentsInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    taskTitleSearch: string;
    processPhaseNameOrId?: string | null;
    limit?: number;
  },
) {
  const room = await resolveAgentRoom(user, input.roomNameOrId);
  const tasks = await findAgentTasksForMove(user, {
    roomId: room.id,
    roomName: room.name,
    taskTitleSearch: input.taskTitleSearch,
    processPhaseNameOrId: input.processPhaseNameOrId,
  });

  if (tasks.length === 0) {
    throw new Error(
      `Tugas "${input.taskTitleSearch}" tidak ditemukan di ruangan "${room.name}".`,
    );
  }

  return getAgentTaskComments(user, tasks[0]!.id, input.limit);
}

export async function getAgentTaskComments(
  user: AgentUser,
  taskId: string,
  limit = 15,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      project: { select: { room: { select: { id: true } } } },
    },
  });
  if (!task) throw new Error("Tugas tidak ditemukan.");

  await assertAgentRoomAccess(user, task.project.room.id);

  const comments = await prisma.taskComment.findMany({
    where: { taskId },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    taskId,
    taskTitle: task.title,
    count: comments.length,
    comments: comments.reverse().map((c) => ({
      id: c.id,
      body: c.body,
      author: c.author.name?.trim() || c.author.email || "—",
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export async function getAgentInventoryAlerts(
  user: AgentUser,
  params?: { severity?: "all" | "critical" | "low"; limit?: number },
) {
  const role = userRoleToAiRole(user.role);
  if (!canViewInventory(role)) {
    return {
      accessible: false,
      message: "Akses inventori tidak tersedia untuk peran ini.",
      alerts: [],
    };
  }

  const alerts = await getInventoryAlerts(
    role,
    params?.severity ?? "all",
    Math.min(params?.limit ?? 20, 50),
  );

  return { accessible: true, count: alerts.length, alerts };
}
