import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProfileShowcaseStats = {
  tasksDone: number;
  tasksActive: number;
  roomCount: number;
  messageCount: number;
};

export type ProfileShowcaseRoom = {
  id: string;
  name: string;
  logoImage: string | null;
  memberCount: number;
};

export type ProfileShowcaseActivity = {
  id: string;
  title: string;
  projectName: string;
  roomName: string;
  doneAt: Date;
};

export type ProfileShowcaseData = {
  stats: ProfileShowcaseStats;
  rooms: ProfileShowcaseRoom[];
  recentDoneTasks: ProfileShowcaseActivity[];
};

/** Data showcase profil ala Steam: statistik, ruangan, dan aktivitas terbaru. */
export async function getProfileShowcaseData(
  userId: string,
): Promise<ProfileShowcaseData> {
  const [tasksDone, tasksActive, memberships, messageCount, recentDone] =
    await Promise.all([
      prisma.taskAssignee.count({
        where: { userId, task: { status: TaskStatus.DONE } },
      }),
      prisma.taskAssignee.count({
        where: {
          userId,
          task: { status: { not: TaskStatus.DONE }, archivedAt: null },
        },
      }),
      prisma.roomMember.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          room: {
            select: {
              id: true,
              name: true,
              logoImage: true,
              _count: { select: { members: true } },
            },
          },
        },
      }),
      prisma.roomMessage.count({
        where: { authorId: userId, deletedAt: null },
      }),
      prisma.task.findMany({
        where: {
          status: TaskStatus.DONE,
          assignees: { some: { userId } },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          project: {
            select: {
              name: true,
              room: { select: { name: true } },
            },
          },
        },
      }),
    ]);

  return {
    stats: {
      tasksDone,
      tasksActive,
      roomCount: memberships.length,
      messageCount,
    },
    rooms: memberships.map((m) => ({
      id: m.room.id,
      name: m.room.name,
      logoImage: m.room.logoImage,
      memberCount: m.room._count.members,
    })),
    recentDoneTasks: recentDone.map((t) => ({
      id: t.id,
      title: t.title,
      projectName: t.project.name,
      roomName: t.project.room.name,
      doneAt: t.updatedAt,
    })),
  };
}
