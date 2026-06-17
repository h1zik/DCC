import {
  TaskStatus,
  UserRole,
  type NotificationType,
  type Prisma,
} from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canSeeAllRooms } from "@/lib/agent/access";
import {
  getUpcomingDeadlines,
  summarizeUserWorkspaces,
} from "@/lib/agent/analytics";
import type { AgentUser } from "@/lib/agent/types";
import { hrefForNotificationType } from "@/lib/notification-link";
import { PIPELINE_LABELS } from "@/lib/pipeline";
import { roomTaskProcessLabel } from "@/lib/room-task-process";
import { isStudioOrProjectManager } from "@/lib/roles";

const FOR_ME_STATUSES: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.OVERDUE,
];

export type WorkspaceDashboardMyTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  roomId: string;
  roomName: string;
  roomProcess: string;
  processLabel: string;
  checklistItems: { id: string; title: string; done: boolean }[];
};

export type WorkspaceDashboardDeadline = {
  id: string;
  title: string;
  dueDate: string;
  roomId: string;
  roomName: string;
  status: TaskStatus;
};

export type WorkspaceDashboardRoomSummary = {
  roomId: string;
  roomName: string;
  brandName: string | null;
  totalActive: number;
  overdue: number;
  inProgress: number;
  myTasks: number;
};

export type WorkspaceDashboardNotification = {
  id: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  href: string;
};

export type WorkspaceDashboardPendingPipeline = {
  id: string;
  name: string;
  brandName: string | null;
  roomName: string;
  pendingStageLabel: string | null;
};

export type WorkspaceDashboardData = {
  kpis: {
    myActiveTasks: number;
    totalOverdue: number;
    blockedCount: number;
    unreadNotifications: number;
    pendingPipeline: number;
  };
  myTasks: WorkspaceDashboardMyTask[];
  deadlines: WorkspaceDashboardDeadline[];
  rooms: WorkspaceDashboardRoomSummary[];
  notifications: WorkspaceDashboardNotification[];
  pendingPipeline: WorkspaceDashboardPendingPipeline[];
  canViewPipeline: boolean;
  roomCount: number;
  highlights: string[];
};

function roomScopeWhere(user: AgentUser): Prisma.RoomWhereInput {
  if (canSeeAllRooms(user)) return {};
  return { members: { some: { userId: user.id } } };
}

function canViewPipelineWidget(role: UserRole): boolean {
  return (
    role === UserRole.ADMINISTRATOR ||
    role === UserRole.PROJECT_MANAGER ||
    role === UserRole.CEO
  );
}

async function loadWorkspaceDashboardData(
  userId: string,
  role: string,
  name: string | null,
  email: string | null,
): Promise<WorkspaceDashboardData> {
  const user: AgentUser = { id: userId, name, email, role };
  const userRole = role as UserRole;
  const roomWhere = roomScopeWhere(user);
  const showPipeline = canViewPipelineWidget(userRole);

  const [
    myTasksRaw,
    workspaceSummary,
    deadlinesResult,
    blockedCount,
    unreadNotificationsCount,
    notificationsRaw,
    pendingPipelineCount,
    pendingPipelineRaw,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        archivedAt: null,
        status: { in: FOR_ME_STATUSES },
        assignees: { some: { userId } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 8,
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
            roomId: true,
            room: { select: { name: true } },
          },
        },
      },
    }),
    summarizeUserWorkspaces(user),
    getUpcomingDeadlines(user, { daysAhead: 7, limit: 8 }),
    prisma.task.count({
      where: {
        archivedAt: null,
        status: TaskStatus.BLOCKED,
        project: { room: roomWhere },
      },
    }),
    prisma.notification.count({
      where: { userId, isRead: false },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        message: true,
        type: true,
        isRead: true,
        createdAt: true,
      },
    }),
    showPipeline
      ? prisma.project.count({
          where: {
            pendingPipelineStage: { not: null },
            brandId: { not: null },
            room: roomWhere,
          },
        })
      : Promise.resolve(0),
    showPipeline
      ? prisma.project.findMany({
          where: {
            pendingPipelineStage: { not: null },
            brandId: { not: null },
            room: roomWhere,
          },
          select: {
            id: true,
            name: true,
            pendingPipelineStage: true,
            brand: { select: { name: true } },
            room: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
        })
      : Promise.resolve([]),
  ]);

  const myActiveTasks = await prisma.task.count({
    where: {
      archivedAt: null,
      status: { in: FOR_ME_STATUSES },
      assignees: { some: { userId } },
    },
  });

  const myTasks: WorkspaceDashboardMyTask[] = myTasksRaw.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    dueDate: t.dueDate?.toISOString() ?? null,
    roomId: t.project.roomId,
    roomName: t.project.room.name,
    roomProcess: t.roomProcess,
    processLabel: roomTaskProcessLabel(t.roomProcess),
    checklistItems: t.checklistItems,
  }));

  const deadlines: WorkspaceDashboardDeadline[] = deadlinesResult.tasks.map(
    (t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate!,
      roomId: t.roomId,
      roomName: t.roomName,
      status: t.status,
    }),
  );

  const notifications: WorkspaceDashboardNotification[] = notificationsRaw.map(
    (n) => ({
      id: n.id,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      href: hrefForNotificationType(n.type),
    }),
  );

  const pendingPipeline: WorkspaceDashboardPendingPipeline[] =
    pendingPipelineRaw.map((p) => ({
      id: p.id,
      name: p.name,
      brandName: p.brand?.name ?? null,
      roomName: p.room.name,
      pendingStageLabel: p.pendingPipelineStage
        ? PIPELINE_LABELS[p.pendingPipelineStage]
        : null,
    }));

  return {
    kpis: {
      myActiveTasks,
      totalOverdue: workspaceSummary.totalOverdue,
      blockedCount,
      unreadNotifications: unreadNotificationsCount,
      pendingPipeline: pendingPipelineCount,
    },
    myTasks,
    deadlines,
    rooms: workspaceSummary.rooms,
    notifications,
    pendingPipeline,
    canViewPipeline: showPipeline,
    roomCount: workspaceSummary.roomCount,
    highlights: workspaceSummary.highlights,
  };
}

export async function getWorkspaceDashboardData(session: {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: UserRole;
  };
}): Promise<WorkspaceDashboardData> {
  const { id, name = null, email = null, role } = session.user;
  const cached = unstable_cache(
    () => loadWorkspaceDashboardData(id, role, name ?? null, email ?? null),
    [`workspace-dashboard-${id}-${role}`],
    { revalidate: 60 },
  );
  return cached();
}

export function canAccessWorkspaceDashboard(role: UserRole | undefined): boolean {
  if (!role) return false;
  return role === UserRole.ADMINISTRATOR || isStudioOrProjectManager(role);
}
