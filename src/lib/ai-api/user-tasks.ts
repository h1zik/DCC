import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { taskStatusLabel } from "@/lib/task-status-ui";
import type { AiApiRole } from "./auth";
import { canViewTasks } from "./auth";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

const TASK_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  project: {
    select: {
      name: true,
      brand: { select: { name: true } },
      room: { select: { id: true, name: true } },
    },
  },
  assignees: {
    select: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

type ResolvedUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

function denied(message: string) {
  return { accessible: false as const, message, data: null };
}

function displayName(u: { name: string | null; email: string | null }) {
  return u.name?.trim() || u.email || "—";
}

export async function resolveOrgUser(query: string) {
  const q = query.trim();
  if (!q) {
    return {
      ok: false as const,
      error: "Nama, email, atau ID user wajib diisi.",
    };
  }

  const byId = await prisma.user.findUnique({
    where: { id: q },
    select: USER_SELECT,
  });
  if (byId) return { ok: true as const, user: byId };

  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: q, mode: "insensitive" } },
    select: USER_SELECT,
  });
  if (byEmail) return { ok: true as const, user: byEmail };

  const matches = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: USER_SELECT,
    orderBy: { name: "asc" },
    take: 10,
  });

  if (matches.length === 1) return { ok: true as const, user: matches[0]! };
  if (matches.length === 0) {
    return {
      ok: false as const,
      error: `User "${q}" tidak ditemukan. Coba nama lengkap, email, atau panggil get_users_task_overview untuk daftar semua PIC.`,
    };
  }

  return {
    ok: false as const,
    error: `Beberapa user cocok dengan "${q}": ${matches
      .map((u) => `${displayName(u)} (${u.email ?? u.id})`)
      .join(", ")}. Perjelas nama atau gunakan email.`,
    suggestions: matches.map((u) => ({
      id: u.id,
      name: displayName(u),
      email: u.email,
    })),
  };
}

type TaskRow = Awaited<
  ReturnType<typeof prisma.task.findMany<{ select: typeof TASK_SELECT }>>
>[number];

function formatTaskRow(t: TaskRow, focusUserId: string) {
  const coAssignees = t.assignees
    .filter((a) => a.user.id !== focusUserId)
    .map((a) => displayName(a.user));

  return {
    id: t.id,
    title: t.title,
    status: t.status,
    statusLabel: taskStatusLabel(t.status),
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
    roomId: t.project.room.id,
    roomName: t.project.room.name,
    projectContext: taskProjectContextLabel(t.project),
    coAssignees,
  };
}

function countStatuses(tasks: { status: TaskStatus }[]) {
  const counts = {
    total: tasks.length,
    overdue: 0,
    blocked: 0,
    inProgress: 0,
    inReview: 0,
    todo: 0,
    done: 0,
  };

  for (const t of tasks) {
    switch (t.status) {
      case TaskStatus.OVERDUE:
        counts.overdue += 1;
        break;
      case TaskStatus.BLOCKED:
        counts.blocked += 1;
        break;
      case TaskStatus.IN_PROGRESS:
        counts.inProgress += 1;
        break;
      case TaskStatus.IN_REVIEW:
        counts.inReview += 1;
        break;
      case TaskStatus.TODO:
        counts.todo += 1;
        break;
      case TaskStatus.DONE:
        counts.done += 1;
        break;
    }
  }

  counts.total = tasks.length;
  return counts;
}

const ACTIVE_STATUSES: TaskStatus[] = [
  TaskStatus.OVERDUE,
  TaskStatus.BLOCKED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.TODO,
];

export async function aiGetUserTasks(
  role: AiApiRole,
  params: {
    userNameOrEmailOrId: string;
    status?: TaskStatus;
    includeDone?: boolean;
    limit?: number;
  },
) {
  if (!canViewTasks(role)) {
    return denied("Akses tugas per user tidak tersedia untuk peran ini.");
  }

  const resolved = await resolveOrgUser(params.userNameOrEmailOrId);
  if (!resolved.ok) {
    return {
      accessible: false as const,
      message: resolved.error,
      suggestions: "suggestions" in resolved ? resolved.suggestions : undefined,
      data: null,
    };
  }

  const user = resolved.user;
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const statuses =
    params.status !== undefined
      ? [params.status]
      : params.includeDone
        ? undefined
        : ACTIVE_STATUSES;

  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: null,
      assignees: { some: { userId: user.id } },
      ...(statuses ? { status: { in: statuses } } : {}),
    },
    select: TASK_SELECT,
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });

  const totalAssigned = await prisma.task.count({
    where: {
      archivedAt: null,
      assignees: { some: { userId: user.id } },
      ...(params.includeDone ? {} : { status: { in: ACTIVE_STATUSES } }),
    },
  });

  const allForCounts = await prisma.task.findMany({
    where: {
      archivedAt: null,
      assignees: { some: { userId: user.id } },
    },
    select: { status: true },
  });

  return {
    accessible: true as const,
    user: {
      id: user.id,
      name: displayName(user),
      email: user.email,
      role: user.role,
    },
    counts: countStatuses(allForCounts),
    activeCount: allForCounts.filter((t) => t.status !== TaskStatus.DONE).length,
    totalAssignedMatchingFilter: totalAssigned,
    returnedCount: tasks.length,
    truncated: totalAssigned > tasks.length,
    tasks: tasks.map((t) => formatTaskRow(t, user.id)),
  };
}

export async function aiGetUsersTaskOverview(
  role: AiApiRole,
  params?: {
    includeTaskTitles?: boolean;
    tasksPerUser?: number;
    limit?: number;
    activeOnly?: boolean;
  },
) {
  if (!canViewTasks(role)) {
    return denied("Ringkasan tugas per user tidak tersedia untuk peran ini.");
  }

  const includeTaskTitles = params?.includeTaskTitles ?? false;
  const tasksPerUser = Math.min(Math.max(params?.tasksPerUser ?? 8, 1), 20);
  const userLimit = Math.min(Math.max(params?.limit ?? 50, 1), 80);
  const activeOnly = params?.activeOnly ?? true;

  const statusFilter = activeOnly ? { in: ACTIVE_STATUSES } : undefined;

  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: null,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      project: {
        select: {
          room: { select: { name: true } },
        },
      },
      assignees: {
        select: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
  });

  type UserBucket = {
    user: ResolvedUser;
    tasks: typeof tasks;
  };

  const byUser = new Map<string, UserBucket>();

  for (const task of tasks) {
    for (const { user } of task.assignees) {
      const bucket = byUser.get(user.id) ?? { user, tasks: [] };
      bucket.tasks.push(task);
      byUser.set(user.id, bucket);
    }
  }

  const usersWithTasks = [...byUser.values()]
    .map(({ user, tasks: userTasks }) => {
      const counts = countStatuses(userTasks);
      return {
        userId: user.id,
        name: displayName(user),
        email: user.email,
        role: user.role,
        ...counts,
        activeCount:
          counts.overdue +
          counts.blocked +
          counts.inProgress +
          counts.inReview +
          counts.todo,
        tasks: includeTaskTitles
          ? userTasks.slice(0, tasksPerUser).map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              statusLabel: taskStatusLabel(t.status),
              dueDate: t.dueDate?.toISOString() ?? null,
              roomName: t.project.room.name,
            }))
          : undefined,
      };
    })
    .sort(
      (a, b) =>
        b.activeCount - a.activeCount ||
        b.total - a.total ||
        a.name.localeCompare(b.name),
    )
    .slice(0, userLimit);

  const unassignedActive = await prisma.task.count({
    where: {
      archivedAt: null,
      status: { in: ACTIVE_STATUSES },
      assignees: { none: {} },
    },
  });

  return {
    accessible: true as const,
    activeOnly,
    totalUsersWithTasks: byUser.size,
    unassignedActiveTasks: unassignedActive,
    users: usersWithTasks,
    hint: includeTaskTitles
      ? "Gunakan get_user_tasks dengan userNameOrEmailOrId untuk daftar lengkap per orang."
      : "Set includeTaskTitles=true atau panggil get_user_tasks untuk detail judul tugas.",
  };
}
