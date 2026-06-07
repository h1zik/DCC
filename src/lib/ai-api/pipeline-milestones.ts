import { RoomTimelineStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildMilestoneTree,
  computeMilestoneProgress,
  seedDefaultProjectMilestones,
  topLevelMilestones,
  type ProjectMilestoneFlat,
  type ProjectMilestoneNode,
} from "@/lib/project-milestones";

export const PROJECT_MILESTONE_SELECT = {
  id: true,
  parentId: true,
  title: true,
  description: true,
  status: true,
  sortOrder: true,
  updatedAt: true,
} as const;

export type ProjectMilestoneRow = {
  id: string;
  parentId: string | null;
  title: string;
  description: string | null;
  status: RoomTimelineStatus;
  sortOrder: number;
  updatedAt: Date;
};

export const MILESTONE_STATUS_LABELS: Record<RoomTimelineStatus, string> = {
  [RoomTimelineStatus.UPCOMING]: "Belum mulai",
  [RoomTimelineStatus.IN_PROGRESS]: "Berjalan",
  [RoomTimelineStatus.DONE]: "Selesai",
  [RoomTimelineStatus.BLOCKED]: "Terhambat",
};

export const PIPELINE_PROGRESS_NOTE =
  "Progress = milestone utama berstatus Selesai ÷ total milestone utama (0–100%).";

export function formatMilestoneStatus(status: RoomTimelineStatus) {
  return {
    status,
    statusLabel: MILESTONE_STATUS_LABELS[status],
  };
}

export function getCurrentActiveMilestone<T extends ProjectMilestoneFlat>(
  milestones: T[],
): T | null {
  const tops = topLevelMilestones(milestones).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  if (tops.length === 0) return null;

  const inProgress = tops.find(
    (m) => m.status === RoomTimelineStatus.IN_PROGRESS,
  );
  if (inProgress) return inProgress;

  const upcoming = tops.find((m) => m.status === RoomTimelineStatus.UPCOMING);
  if (upcoming) return upcoming;

  const blocked = tops.find((m) => m.status === RoomTimelineStatus.BLOCKED);
  if (blocked) return blocked;

  return tops[tops.length - 1] ?? null;
}

export function getNextMilestone<T extends ProjectMilestoneFlat>(
  milestones: T[],
): T | null {
  const tops = topLevelMilestones(milestones).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const current = getCurrentActiveMilestone(milestones);
  if (!current) return tops[0] ?? null;

  const idx = tops.findIndex((m) => m.id === current.id);
  if (idx < 0) return null;
  return tops[idx + 1] ?? null;
}

export function summarizeProjectMilestones(milestones: ProjectMilestoneRow[]) {
  const tops = topLevelMilestones(milestones).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const progressPct = computeMilestoneProgress(milestones);
  const topLevelDone = tops.filter(
    (m) => m.status === RoomTimelineStatus.DONE,
  ).length;
  const inProgressCount = tops.filter(
    (m) => m.status === RoomTimelineStatus.IN_PROGRESS,
  ).length;
  const blockedCount = tops.filter(
    (m) => m.status === RoomTimelineStatus.BLOCKED,
  ).length;
  const current = getCurrentActiveMilestone(milestones);
  const next = getNextMilestone(milestones);

  return {
    progressPct,
    topLevelDone,
    topLevelTotal: tops.length,
    subMilestoneCount: milestones.length - tops.length,
    inProgressCount,
    blockedCount,
    currentMilestone: current
      ? {
          id: current.id,
          title: current.title,
          ...formatMilestoneStatus(current.status),
          updatedAt: current.updatedAt.toISOString(),
        }
      : null,
    nextMilestone: next
      ? { id: next.id, title: next.title, ...formatMilestoneStatus(next.status) }
      : null,
  };
}

export type FormattedMilestoneNode = {
  id: string;
  parentId: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
  status: RoomTimelineStatus;
  statusLabel: string;
  children: FormattedMilestoneNode[];
};

export function formatMilestoneNode(node: ProjectMilestoneNode): FormattedMilestoneNode {
  return {
    id: node.id,
    parentId: node.parentId,
    title: node.title,
    description: node.description,
    sortOrder: node.sortOrder,
    ...formatMilestoneStatus(node.status),
    children: node.children.map(formatMilestoneNode),
  };
}

export async function loadBrandProjectsWithMilestones() {
  const projects = await prisma.project.findMany({
    where: { brandId: { not: null } },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      brand: { select: { name: true } },
      room: { select: { name: true } },
      milestones: {
        select: PROJECT_MILESTONE_SELECT,
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const withoutMilestones = projects.filter((p) => p.milestones.length === 0);
  if (withoutMilestones.length > 0) {
    await Promise.all(
      withoutMilestones.map((p) => seedDefaultProjectMilestones(prisma, p.id)),
    );
    for (const p of withoutMilestones) {
      p.milestones = await prisma.projectMilestone.findMany({
        where: { projectId: p.id },
        select: PROJECT_MILESTONE_SELECT,
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      });
    }
  }

  return projects;
}

export function groupProjectsByCurrentMilestone<
  T extends {
    currentMilestone: { title: string } | null;
  },
>(projects: T[]) {
  const groups = new Map<string, T[]>();
  for (const p of projects) {
    const key = p.currentMilestone?.title ?? "Tanpa milestone";
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([milestoneTitle, rows]) => ({
      milestoneTitle,
      count: rows.length,
      projects: rows,
    }));
}
