import {
  TaskStatus,
  UserRole,
  type NotificationType,
  type Prisma,
} from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canSeeAllRooms } from "@/lib/agent/access";
import type { AgentUser } from "@/lib/agent/types";
import { hrefForNotificationType } from "@/lib/notification-link";
import { PIPELINE_LABELS } from "@/lib/pipeline";
import { getNavRooms, type NavRoom } from "@/lib/room-nav-data";
import { roomTaskProcessLabel } from "@/lib/room-task-process";
import { isStudioOrProjectManager } from "@/lib/roles";

const FOR_ME_STATUSES: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.OVERDUE,
];

export type HomeFocusTask = {
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

export type HomeNotification = {
  id: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  href: string;
};

export type HomePendingPipeline = {
  id: string;
  name: string;
  brandName: string | null;
  roomName: string;
  pendingStageLabel: string | null;
};

export type HomeContinueRoom = Pick<
  NavRoom,
  "id" | "name" | "logoImage" | "brandColor" | "unreadChatCount" | "openTaskCount"
>;

export type HomeTodayEvent = {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
};

export type HomeTodayData = {
  displayName: string;
  focusTasks: HomeFocusTask[];
  notifications: HomeNotification[];
  pendingPipeline: HomePendingPipeline[];
  continueRooms: HomeContinueRoom[];
  todayEvents: HomeTodayEvent[];
  canViewPipeline: boolean;
  hasAnyAttention: boolean;
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

function isDueToday(due: Date | null): boolean {
  if (!due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
}

function focusTaskPriority(
  status: TaskStatus,
  dueDate: Date | null,
): number {
  if (status === TaskStatus.OVERDUE) return 0;
  if (isDueToday(dueDate)) return 1;
  if (status === TaskStatus.IN_PROGRESS) return 2;
  return 3;
}

function pickContinueRooms(rooms: NavRoom[]): HomeContinueRoom[] {
  return [...rooms]
    .sort(
      (a, b) =>
        b.unreadChatCount - a.unreadChatCount ||
        b.openTaskCount - a.openTaskCount ||
        a.name.localeCompare(b.name, "id"),
    )
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      name: r.name,
      logoImage: r.logoImage,
      brandColor: r.brandColor,
      unreadChatCount: r.unreadChatCount,
      openTaskCount: r.openTaskCount,
    }));
}

async function loadHomeData(
  userId: string,
  role: string,
  name: string | null,
  email: string | null,
): Promise<HomeTodayData> {
  const user: AgentUser = { id: userId, name, email, role };
  const userRole = role as UserRole;
  const roomWhere = roomScopeWhere(user);
  const showPipeline = canViewPipelineWidget(userRole);

  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [
    focusTasksRaw,
    notificationsRaw,
    pendingPipelineRaw,
    navRooms,
    todayEventsRaw,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        archivedAt: null,
        status: { in: FOR_ME_STATUSES },
        assignees: { some: { userId } },
      },
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
    prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        message: true,
        type: true,
        isRead: true,
        createdAt: true,
      },
    }),
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
          take: 2,
        })
      : Promise.resolve([]),
    getNavRooms(userId, userRole),
    prisma.scheduleEvent.findMany({
      where: {
        startsAt: { gte: now, lte: endOfToday },
      },
      orderBy: { startsAt: "asc" },
      take: 2,
      select: {
        id: true,
        title: true,
        startsAt: true,
        location: true,
      },
    }),
  ]);

  const focusTasks: HomeFocusTask[] = focusTasksRaw
    .sort((a, b) => {
      const pa = focusTaskPriority(a.status, a.dueDate);
      const pb = focusTaskPriority(b.status, b.dueDate);
      if (pa !== pb) return pa - pb;
      const da = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const db = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    })
    .slice(0, 5)
    .map((t) => ({
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

  const notifications: HomeNotification[] = notificationsRaw.map((n) => ({
    id: n.id,
    message: n.message,
    type: n.type,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
    href: hrefForNotificationType(n.type),
  }));

  const pendingPipeline: HomePendingPipeline[] = pendingPipelineRaw.map((p) => ({
    id: p.id,
    name: p.name,
    brandName: p.brand?.name ?? null,
    roomName: p.room.name,
    pendingStageLabel: p.pendingPipelineStage
      ? PIPELINE_LABELS[p.pendingPipelineStage]
      : null,
  }));

  const todayEvents: HomeTodayEvent[] = todayEventsRaw.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    location: e.location,
  }));

  const hasAnyAttention =
    focusTasks.length > 0 ||
    notifications.length > 0 ||
    pendingPipeline.length > 0;

  const displayName =
    name?.trim() || email?.split("@")[0]?.trim() || "kamu";

  return {
    displayName,
    focusTasks,
    notifications,
    pendingPipeline,
    continueRooms: pickContinueRooms(navRooms),
    todayEvents,
    canViewPipeline: showPipeline,
    hasAnyAttention,
  };
}

export async function getHomeData(session: {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: UserRole;
  };
}): Promise<HomeTodayData> {
  const { id, name = null, email = null, role } = session.user;
  const cached = unstable_cache(
    () => loadHomeData(id, role, name ?? null, email ?? null),
    [`home-today-${id}-${role}`],
    { revalidate: 60 },
  );
  return cached();
}

export function canAccessHome(role: UserRole | undefined): boolean {
  if (!role) return false;
  return role === UserRole.ADMINISTRATOR || isStudioOrProjectManager(role);
}
