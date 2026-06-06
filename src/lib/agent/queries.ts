import { RoomTaskProcess, TaskStatus, type TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getKpiOverview, getOverdueTasks } from "@/lib/ai-api/queries";
import type { AiApiRole } from "@/lib/ai-api/auth";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { taskStatusLabel } from "@/lib/task-status-ui";
import {
  buildRoomProcessPhaseList,
  defaultRoomProcessPhaseRef,
  isLegacyRoomTaskProcess,
  taskPhaseWhere,
  taskToPhaseRef,
} from "@/lib/room-process-phase";
import { roomTaskProcessLabel } from "@/lib/room-task-process";
import { ensureRoomProcessPhases } from "@/lib/room-process-phases-seed";
import {
  ensureSimpleRoomBoardProject,
  isSimpleTeamOrHqRoom,
} from "@/lib/room-simple-hub";
import {
  getRoomKanbanColumns,
  getSimpleHubKanbanColumns,
} from "@/lib/room-kanban-columns";
import {
  assertAgentRoomAccess,
  canSeeAllRooms,
} from "./access";
import {
  formatRoomSuggestMessage,
  matchAgentRoom,
} from "./room-match";
import {
  formatDuplicateTaskMessage,
  isBulkTaskTitleSearch,
} from "./task-disambiguation";
import { isSelfAssigneeReference } from "./user-context";
import {
  getAgentUserAccessSummary,
  userCanAccessTaskPhase,
} from "./user-access";
import type {
  AgentKanbanBoard,
  AgentRoomSummary,
  AgentTaskSummary,
  AgentUser,
} from "./types";

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

function mapTaskRow(
  t: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | null;
    roomProcess: import("@prisma/client").RoomTaskProcess;
    customProcessPhaseId: string | null;
    customProcessPhase: {
      id: string;
      name: string;
      legacyProcessKey: import("@prisma/client").RoomTaskProcess | null;
    } | null;
    project: {
      name: string;
      brand: { name: string } | null;
      room: {
        id: string;
        name: string;
        brandId: string | null;
        workspaceSection: import("@prisma/client").RoomWorkspaceSection;
      };
    };
    assignees: {
      user: { id: string; name: string | null; email: string | null };
    }[];
  },
  viewerUserId?: string,
): AgentTaskSummary {
  const simpleHub = isSimpleTeamOrHqRoom(t.project.room);
  const phase = simpleHub
    ? { id: null as string | null, name: "Tasks" }
    : taskToPhaseRef(t);
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    statusLabel: taskStatusLabel(t.status),
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
    assignees: t.assignees.map(
      (a) => a.user.name?.trim() || a.user.email || "—",
    ),
    projectName: taskProjectContextLabel(t.project),
    roomName: t.project.room.name,
    roomId: t.project.room.id,
    phaseId: phase.id,
    phaseName: phase.name,
    isAssignedToMe: viewerUserId
      ? t.assignees.some((a) => a.user.id === viewerUserId)
      : false,
  };
}

const taskSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  description: true,
  archivedAt: true,
  isApprovalRequired: true,
  isApproved: true,
  roomProcess: true,
  customProcessPhaseId: true,
  customProcessPhase: {
    select: { id: true, name: true, legacyProcessKey: true },
  },
  project: {
    select: {
      id: true,
      name: true,
      brand: { select: { name: true } },
      room: { select: { id: true, name: true, brandId: true, workspaceSection: true } },
    },
  },
  assignees: {
    select: { user: { select: { id: true, name: true, email: true } } },
  },
  tags: {
    select: { tag: { select: { name: true, colorHex: true } } },
  },
  checklistItems: {
    select: { id: true, title: true, done: true },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

export async function listAgentRooms(user: AgentUser): Promise<AgentRoomSummary[]> {
  const rooms = await prisma.room.findMany({
    where: canSeeAllRooms(user)
      ? {}
      : { members: { some: { userId: user.id } } },
    select: {
      id: true,
      name: true,
      workspaceSection: true,
      brand: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    brandName: r.brand?.name ?? null,
    workspaceSection: r.workspaceSection,
  }));
}

export async function listAgentRoomMembers(
  user: AgentUser,
  roomId: string,
): Promise<{ id: string; name: string; email: string | null; role: string }[]> {
  await assertAgentRoomAccess(user, roomId);

  const members = await prisma.roomMember.findMany({
    where: { roomId },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return members.map((m) => ({
    id: m.user.id,
    name: m.user.name?.trim() || m.user.email || "—",
    email: m.user.email,
    role: m.role,
  }));
}

export async function resolveAgentRoom(
  user: AgentUser,
  roomNameOrId: string,
): Promise<AgentRoomSummary> {
  const rooms = await listAgentRooms(user);
  const result = matchAgentRoom(roomNameOrId, rooms);

  if (result.kind === "exact" || result.kind === "fuzzy") {
    return result.room;
  }

  if (result.kind === "suggest") {
    throw new Error(
      formatRoomSuggestMessage(result.query, result.suggestions),
    );
  }

  const available =
    rooms.length > 0
      ? ` Ruangan tersedia: ${rooms.map((r) => r.name).join(", ")}.`
      : "";
  throw new Error(
    `Ruangan "${roomNameOrId}" tidak ditemukan.${available} Gunakan list_rooms untuk cek nama ruangan.`,
  );
}

function normalizePhaseSearchKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\band\b/g, "")
    .replace(/&/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function listAgentRoomProcessPhases(
  user: AgentUser,
  roomId: string,
): Promise<{ id: string; name: string; legacyProcessKey: string | null }[]> {
  await assertAgentRoomAccess(user, roomId);

  const room = await prisma.room.findUniqueOrThrow({
    where: { id: roomId },
    select: { brandId: true, workspaceSection: true },
  });

  if (isSimpleTeamOrHqRoom(room)) {
    return [{ id: "simple-hub", name: "Tasks", legacyProcessKey: null }];
  }

  const phases = await ensureRoomProcessPhases(roomId);
  return phases.map((p) => ({
    id: p.id,
    name: p.name,
    legacyProcessKey: p.legacyProcessKey,
  }));
}

export async function resolveAgentProcessPhase(
  user: AgentUser,
  roomId: string,
  phaseNameOrId: string,
): Promise<{ id: string; name: string }> {
  const phases = await listAgentRoomProcessPhases(user, roomId);
  const raw = phaseNameOrId.trim();

  const byId = phases.find((p) => p.id === raw);
  if (byId) return { id: byId.id, name: byId.name };

  const q = raw.toLowerCase();
  const exact = phases.find((p) => p.name.toLowerCase() === q);
  if (exact) return { id: exact.id, name: exact.name };

  if (isLegacyRoomTaskProcess(raw)) {
    const byLegacy = phases.find((p) => p.legacyProcessKey === raw);
    if (byLegacy) return { id: byLegacy.id, name: byLegacy.name };
  }

  const normalizedQuery = normalizePhaseSearchKey(raw);
  for (const legacy of Object.values(RoomTaskProcess)) {
    const labelKey = normalizePhaseSearchKey(roomTaskProcessLabel(legacy));
    const enumKey = normalizePhaseSearchKey(legacy);
    if (normalizedQuery === labelKey || normalizedQuery === enumKey) {
      const byLegacy = phases.find((p) => p.legacyProcessKey === legacy);
      if (byLegacy) return { id: byLegacy.id, name: byLegacy.name };
    }
  }

  const partial = phases.filter((p) => {
    const nameKey = normalizePhaseSearchKey(p.name);
    if (
      nameKey === normalizedQuery ||
      nameKey.includes(normalizedQuery) ||
      normalizedQuery.includes(nameKey)
    ) {
      return true;
    }

    const words = raw
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2);
    if (words.length === 0) return false;
    const nameLower = p.name.toLowerCase();
    return words.every((w) => nameLower.includes(w));
  });

  if (partial.length === 1) return { id: partial[0]!.id, name: partial[0]!.name };
  if (partial.length > 1) {
    throw new Error(
      `Beberapa fase cocok dengan "${phaseNameOrId}": ${partial.map((p) => p.name).join(", ")}. Sebutkan nama yang lebih spesifik.`,
    );
  }

  throw new Error(
    `Fase proses "${phaseNameOrId}" tidak ditemukan di ruangan ini. Fase tersedia: ${phases.map((p) => p.name).join(", ")}.`,
  );
}

export async function resolveDefaultProjectForRoom(
  user: AgentUser,
  roomId: string,
): Promise<{ id: string; name: string }> {
  await assertAgentRoomAccess(user, roomId);

  const room = await prisma.room.findUniqueOrThrow({
    where: { id: roomId },
    select: { brandId: true, workspaceSection: true },
  });

  if (isSimpleTeamOrHqRoom(room)) {
    await ensureSimpleRoomBoardProject(roomId);
    const board = await prisma.project.findFirst({
      where: { roomId, brandId: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    if (!board) {
      throw new Error("Belum ada proyek papan di ruangan ini.");
    }
    return board;
  }

  const projects = await listAgentRoomProjects(user, roomId);
  if (projects.length === 0) {
    throw new Error("Belum ada proyek di ruangan ini.");
  }
  return projects[0]!;
}

export async function resolveAssigneeIdsByName(
  user: AgentUser,
  roomId: string,
  names: string[],
): Promise<string[]> {
  if (names.length === 0) return [];

  const members = await listAgentRoomMembers(user, roomId);
  const ids: string[] = [];

  for (const rawName of names) {
    const n = rawName.trim().toLowerCase();
    if (!n) continue;

    if (isSelfAssigneeReference(rawName)) {
      const isMember = members.some((m) => m.id === user.id);
      if (!isMember) {
        throw new Error(
          "Anda bukan anggota ruangan ini sehingga tidak bisa ditambahkan sebagai PIC.",
        );
      }
      ids.push(user.id);
      continue;
    }

    const matches = members.filter(
      (m) =>
        m.name.toLowerCase().includes(n) ||
        (m.email?.toLowerCase().includes(n) ?? false),
    );

    if (matches.length === 1) {
      ids.push(matches[0]!.id);
      continue;
    }
    if (matches.length === 0) {
      throw new Error(`Anggota "${rawName}" tidak ditemukan di ruangan ini.`);
    }
    throw new Error(
      `Beberapa anggota cocok dengan "${rawName}": ${matches.map((m) => m.name).join(", ")}.`,
    );
  }

  return [...new Set(ids)];
}

export async function listAgentRoomProjects(
  user: AgentUser,
  roomId: string,
): Promise<{ id: string; name: string }[]> {
  await assertAgentRoomAccess(user, roomId);

  const room = await prisma.room.findUniqueOrThrow({
    where: { id: roomId },
    select: { brandId: true, workspaceSection: true },
  });

  if (isSimpleTeamOrHqRoom(room)) {
    await ensureSimpleRoomBoardProject(roomId);
  }

  const projects = await prisma.project.findMany({
    where: { roomId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return projects;
}

export async function getAgentKanbanBoardByRoomName(
  user: AgentUser,
  roomNameOrId: string,
  processPhaseNameOrId?: string | null,
): Promise<AgentKanbanBoard> {
  const room = await resolveAgentRoom(user, roomNameOrId);
  let phaseId: string | null = null;
  if (processPhaseNameOrId?.trim()) {
    const phase = await resolveAgentProcessPhase(
      user,
      room.id,
      processPhaseNameOrId,
    );
    phaseId = phase.id;
  }
  return getAgentKanbanBoard(user, room.id, phaseId);
}

export async function getAgentKanbanBoard(
  user: AgentUser,
  roomId: string,
  customProcessPhaseId?: string | null,
): Promise<AgentKanbanBoard> {
  await assertAgentRoomAccess(user, roomId);

  const room = await prisma.room.findUniqueOrThrow({
    where: { id: roomId },
    select: { id: true, name: true, brandId: true, workspaceSection: true },
  });

  const simpleHub = isSimpleTeamOrHqRoom(room);
  let phaseName: string | null = null;
  let phaseWhere = {};
  let columns;

  if (simpleHub) {
    await ensureSimpleRoomBoardProject(roomId);
    phaseName = "Tasks";
    columns = await getSimpleHubKanbanColumns(roomId);
  } else {
    const phases = await ensureRoomProcessPhases(roomId);
    const phaseList = buildRoomProcessPhaseList(phases);
    const phase =
      (customProcessPhaseId
        ? phaseList.find((p) => p.id === customProcessPhaseId)
        : null) ?? defaultRoomProcessPhaseRef(phases);
    phaseName = phase.name;
    phaseWhere = taskPhaseWhere(phase);
    columns = await getRoomKanbanColumns(roomId, phase);
  }

  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: null,
      project: { roomId },
      ...phaseWhere,
    },
    select: taskSelect,
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });

  const mapped = tasks.map((t) => mapTaskRow(t, user.id));

  return {
    roomId,
    roomName: room.name,
    phaseName,
    columns: columns.map((col) => ({
      status: col.linkedStatus,
      label: col.title,
      tasks: mapped.filter((t) => t.status === col.linkedStatus),
    })),
  };
}

export async function listAgentTasks(
  user: AgentUser,
  params: {
    roomId?: string;
    status?: TaskStatus;
    search?: string;
    processPhaseNameOrId?: string;
    assignedToMe?: boolean;
    limit?: number;
  },
): Promise<AgentTaskSummary[]> {
  const limit = Math.min(params.limit ?? 30, 50);
  const where: Record<string, unknown> = { archivedAt: null };

  if (params.assignedToMe) {
    where.assignees = { some: { userId: user.id } };
  }

  if (params.roomId) {
    await assertAgentRoomAccess(user, params.roomId);
    where.project = { roomId: params.roomId };

    if (params.processPhaseNameOrId?.trim()) {
      const room = await prisma.room.findUniqueOrThrow({
        where: { id: params.roomId },
        select: { brandId: true, workspaceSection: true },
      });
      if (!isSimpleTeamOrHqRoom(room)) {
        const phase = await resolveAgentProcessPhase(
          user,
          params.roomId,
          params.processPhaseNameOrId,
        );
        where.customProcessPhaseId = phase.id;
      }
    }
  } else if (!canSeeAllRooms(user)) {
    where.project = {
      room: { members: { some: { userId: user.id } } },
    };
  }

  if (params.status) where.status = params.status;
  if (params.search?.trim()) {
    where.title = { contains: params.search.trim(), mode: "insensitive" };
  }

  const rows = await prisma.task.findMany({
    where,
    select: taskSelect,
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });

  const mapped = rows.map((t) => mapTaskRow(t, user.id));

  const filtered: AgentTaskSummary[] = [];
  for (const task of mapped) {
    const allowed = await userCanAccessTaskPhase(user, task.roomId, {
      id: task.phaseId ?? "",
      name: task.phaseName ?? "",
    });
    if (allowed) filtered.push(task);
  }

  return filtered;
}

export async function findAgentTasksForBulkOperation(
  user: AgentUser,
  params: {
    roomId: string;
    roomName: string;
    taskTitleSearches?: string[] | null;
    taskTitleSearch?: string | null;
    processPhaseNameOrId?: string | null;
    status?: TaskStatus | null;
  },
): Promise<AgentTaskSummary[]> {
  const searches = [
    ...(params.taskTitleSearches ?? []),
    ...(params.taskTitleSearch?.trim() ? [params.taskTitleSearch.trim()] : []),
  ].filter(Boolean);

  const isBulk =
    searches.length === 0 ||
    searches.every((s) => isBulkTaskTitleSearch(s));

  if (isBulk) {
    const tasks = await listAgentTasks(user, {
      roomId: params.roomId,
      status: params.status ?? undefined,
      processPhaseNameOrId: params.processPhaseNameOrId ?? undefined,
      limit: 50,
    });
    if (tasks.length === 0) {
      throw new Error(
        `Tidak ada tugas yang cocok di ruangan "${params.roomName}"${params.status ? ` dengan status ${params.status}` : ""}${params.processPhaseNameOrId ? ` fase ${params.processPhaseNameOrId}` : ""}.`,
      );
    }
    return tasks;
  }

  const byId = new Map<string, AgentTaskSummary>();
  for (const search of searches) {
    if (isBulkTaskTitleSearch(search)) continue;
    const matched = await listAgentTasks(user, {
      roomId: params.roomId,
      search,
      processPhaseNameOrId: params.processPhaseNameOrId ?? undefined,
      status: params.status ?? undefined,
      limit: 20,
    });
    for (const t of matched) {
      byId.set(t.id, t);
    }
  }

  if (byId.size === 0) {
    throw new Error(
      `Tidak ada tugas yang cocok dengan "${searches.join('", "')}" di ruangan "${params.roomName}".`,
    );
  }

  return [...byId.values()];
}

export async function findAgentTasksForMove(
  user: AgentUser,
  params: {
    roomId: string;
    roomName: string;
    taskTitleSearch: string;
    processPhaseNameOrId?: string | null;
  },
): Promise<AgentTaskSummary[]> {
  const tasks = await listAgentTasks(user, {
    roomId: params.roomId,
    search: params.taskTitleSearch,
    processPhaseNameOrId: params.processPhaseNameOrId ?? undefined,
    limit: 20,
  });

  if (tasks.length <= 1) return tasks;

  const uniquePhases = new Set(tasks.map((t) => t.phaseId));
  if (uniquePhases.size > 1) {
    throw new Error(
      formatDuplicateTaskMessage(params.roomName, tasks),
    );
  }

  return tasks;
}

export { getAgentUserAccessSummary };

export async function getAgentTaskDetail(user: AgentUser, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: taskSelect,
  });

  if (!task) throw new Error("Tugas tidak ditemukan.");
  await assertAgentRoomAccess(user, task.project.room.id);

  return {
    ...mapTaskRow(task, user.id),
    description: task.description,
    archived: Boolean(task.archivedAt),
    isApprovalRequired: task.isApprovalRequired,
    isApproved: task.isApproved,
    projectId: task.project.id,
    tags: task.tags.map((t) => t.tag.name),
    checklist: task.checklistItems.map((c) => ({
      id: c.id,
      title: c.title,
      done: c.done,
    })),
  };
}

export async function getAgentKpi(user: AgentUser) {
  const role = userRoleToAiRole(user.role);
  return getKpiOverview(role);
}

export async function getAgentOverdueTasks(user: AgentUser, limit = 20) {
  const role = userRoleToAiRole(user.role);
  return getOverdueTasks(role, Math.min(limit, 50));
}
