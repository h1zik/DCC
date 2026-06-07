import {
  FinanceSpendRequestStatus,
  TaskStatus,
  type TaskPriority,
} from "@prisma/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  analyzeRoomWorkload,
  getUpcomingDeadlines,
  summarizeUserWorkspaces,
} from "@/lib/agent/analytics";
import {
  getAgentKanbanBoardByRoomName,
  getAgentTaskDetail,
  listAgentRoomMembers,
  listAgentRooms,
  listAgentTasks,
} from "@/lib/agent/queries";
import { matchAgentRoom } from "@/lib/agent/room-match";
import { getTodayDateString } from "@/lib/attendance";
import { loadFinanceDashboard } from "@/lib/finance-dashboard";
import { formatIdr } from "@/lib/finance-money";
import { PIPELINE_LABELS } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import type { AiApiRole } from "./auth";
import {
  canViewApprovals,
  canViewAttendance,
  canViewFinancePending,
  canViewFinanceSummary,
  canViewRoomsWiki,
  canViewSchedule,
  canViewTasks,
} from "./auth";
import { createAiApiAgentUser } from "./service-user";

function accessDenied(message: string) {
  return { accessible: false as const, message, data: null };
}

function resolveRoomFromQuery(
  rooms: Awaited<ReturnType<typeof listAgentRooms>>,
  roomNameOrId: string,
) {
  const match = matchAgentRoom(roomNameOrId, rooms);
  if (match.kind === "exact" || match.kind === "fuzzy") {
    return { ok: true as const, room: match.room };
  }
  if (match.kind === "suggest") {
    return {
      ok: false as const,
      error: `Ruangan "${roomNameOrId}" tidak ditemukan. Mungkin maksud: ${match.suggestions
        .slice(0, 3)
        .map((s) => s.room.name)
        .join(", ")}.`,
    };
  }
  return { ok: false as const, error: `Ruangan "${roomNameOrId}" tidak ditemukan.` };
}

async function agentUserForOperational(role: AiApiRole) {
  if (!canViewTasks(role)) {
    return null;
  }
  return createAiApiAgentUser(role);
}

/* -------------------------------------------------------------------------- */
/* Batch operasional                                                          */
/* -------------------------------------------------------------------------- */

export async function aiListRooms(role: AiApiRole) {
  const user = await agentUserForOperational(role);
  if (!user) return accessDenied("Akses daftar ruangan tidak tersedia untuk peran ini.");

  const rooms = await listAgentRooms(user);
  return {
    accessible: true as const,
    count: rooms.length,
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      brandName: r.brandName,
      workspaceSection: r.workspaceSection,
    })),
  };
}

export async function aiSummarizeWorkspaces(role: AiApiRole) {
  const user = await agentUserForOperational(role);
  if (!user) return accessDenied("Akses ringkasan workspace tidak tersedia untuk peran ini.");

  const data = await summarizeUserWorkspaces(user);
  return { accessible: true as const, ...data };
}

export async function aiAnalyzeRoomWorkload(role: AiApiRole, roomNameOrId: string) {
  const user = await agentUserForOperational(role);
  if (!user) return accessDenied("Akses analisis ruangan tidak tersedia untuk peran ini.");

  try {
    const data = await analyzeRoomWorkload(user, roomNameOrId);
    return { accessible: true as const, ...data };
  } catch (err) {
    return {
      accessible: false as const,
      message: err instanceof Error ? err.message : "Gagal menganalisis ruangan.",
      data: null,
    };
  }
}

export async function aiGetKanbanBoard(
  role: AiApiRole,
  roomNameOrId: string,
  processPhaseNameOrId?: string | null,
) {
  const user = await agentUserForOperational(role);
  if (!user) return accessDenied("Akses Kanban tidak tersedia untuk peran ini.");

  try {
    const board = await getAgentKanbanBoardByRoomName(
      user,
      roomNameOrId,
      processPhaseNameOrId,
    );
    return {
      accessible: true as const,
      roomId: board.roomId,
      roomName: board.roomName,
      phaseName: board.phaseName,
      columns: board.columns.map((col) => ({
        status: col.status,
        label: col.label,
        taskCount: col.tasks.length,
        tasks: col.tasks.slice(0, 15).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          phaseName: t.phaseName,
          assignees: t.assignees,
          dueDate: t.dueDate,
        })),
      })),
    };
  } catch (err) {
    return {
      accessible: false as const,
      message: err instanceof Error ? err.message : "Gagal memuat Kanban.",
      data: null,
    };
  }
}

export async function aiListTasks(
  role: AiApiRole,
  params: {
    roomNameOrId?: string;
    status?: TaskStatus;
    search?: string;
    limit?: number;
  },
) {
  const user = await agentUserForOperational(role);
  if (!user) return accessDenied("Akses daftar tugas tidak tersedia untuk peran ini.");

  let roomId: string | undefined;
  if (params.roomNameOrId?.trim()) {
    const rooms = await listAgentRooms(user);
    const resolved = resolveRoomFromQuery(rooms, params.roomNameOrId);
    if (!resolved.ok) {
      return { accessible: false as const, message: resolved.error, data: null };
    }
    roomId = resolved.room.id;
  }

  const tasks = await listAgentTasks(user, {
    roomId,
    status: params.status,
    search: params.search,
    limit: params.limit ?? 30,
  });

  return { accessible: true as const, count: tasks.length, tasks };
}

export async function aiGetUpcomingDeadlines(
  role: AiApiRole,
  params?: { daysAhead?: number; roomNameOrId?: string; limit?: number },
) {
  const user = await agentUserForOperational(role);
  if (!user) return accessDenied("Akses deadline tidak tersedia untuk peran ini.");

  try {
    const data = await getUpcomingDeadlines(user, params);
    return { accessible: true as const, ...data };
  } catch (err) {
    return {
      accessible: false as const,
      message: err instanceof Error ? err.message : "Gagal memuat deadline.",
      data: null,
    };
  }
}

export async function aiGetTaskDetail(role: AiApiRole, taskId: string) {
  const user = await agentUserForOperational(role);
  if (!user) return accessDenied("Akses detail tugas tidak tersedia untuk peran ini.");

  try {
    const task = await getAgentTaskDetail(user, taskId);
    return { accessible: true as const, task };
  } catch (err) {
    return {
      accessible: false as const,
      message: err instanceof Error ? err.message : "Tugas tidak ditemukan.",
      data: null,
    };
  }
}

export async function aiListRoomMembers(role: AiApiRole, roomNameOrId: string) {
  const user = await agentUserForOperational(role);
  if (!user) return accessDenied("Akses anggota ruangan tidak tersedia untuk peran ini.");

  const rooms = await listAgentRooms(user);
  const resolved = resolveRoomFromQuery(rooms, roomNameOrId);
  if (!resolved.ok) {
    return { accessible: false as const, message: resolved.error, data: null };
  }

  const members = await listAgentRoomMembers(user, resolved.room.id);
  return {
    accessible: true as const,
    roomId: resolved.room.id,
    roomName: resolved.room.name,
    count: members.length,
    members,
  };
}

/* -------------------------------------------------------------------------- */
/* Batch approval                                                             */
/* -------------------------------------------------------------------------- */

export async function aiListPendingTaskApprovals(role: AiApiRole, limit: number) {
  if (!canViewApprovals(role)) {
    return accessDenied("Akses persetujuan tugas CEO tidak tersedia untuk peran ini.");
  }

  const rows = await prisma.task.findMany({
    where: { isApprovalRequired: true, isApproved: false, archivedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      updatedAt: true,
      project: {
        select: {
          name: true,
          brand: { select: { name: true } },
          room: { select: { name: true } },
        },
      },
      assignees: {
        select: { user: { select: { name: true, email: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return {
    accessible: true as const,
    count: rows.length,
    tasks: rows.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      contextLabel: taskProjectContextLabel(t.project),
      assignees: t.assignees.map(
        (a) => a.user.name?.trim() || a.user.email || "—",
      ),
      updatedAt: t.updatedAt.toISOString(),
    })),
  };
}

export async function aiListPendingPipelineApprovals(role: AiApiRole, limit: number) {
  if (!canViewApprovals(role)) {
    return accessDenied("Akses persetujuan pipeline CEO tidak tersedia untuk peran ini.");
  }

  const rows = await prisma.project.findMany({
    where: { pendingPipelineStage: { not: null }, brandId: { not: null } },
    select: {
      id: true,
      name: true,
      currentStage: true,
      pendingPipelineStage: true,
      pipelineStageRequestedAt: true,
      brand: { select: { name: true } },
      room: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return {
    accessible: true as const,
    count: rows.length,
    projects: rows.map((p) => ({
      id: p.id,
      name: p.name,
      brandName: p.brand?.name ?? null,
      roomName: p.room.name,
      currentStage: p.currentStage,
      currentStageLabel: PIPELINE_LABELS[p.currentStage],
      pendingStage: p.pendingPipelineStage,
      pendingStageLabel: p.pendingPipelineStage
        ? PIPELINE_LABELS[p.pendingPipelineStage]
        : null,
      requestedAt: p.pipelineStageRequestedAt?.toISOString() ?? null,
    })),
  };
}

export async function aiListPendingFinanceSpend(role: AiApiRole, limit: number) {
  if (!canViewFinancePending(role)) {
    return accessDenied("Akses persetujuan pengeluaran tidak tersedia untuk peran ini.");
  }

  const rows = await prisma.financeSpendRequest.findMany({
    where: { status: FinanceSpendRequestStatus.SUBMITTED },
    select: {
      id: true,
      title: true,
      description: true,
      amount: true,
      createdAt: true,
      brand: { select: { name: true } },
      requestedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    accessible: true as const,
    count: rows.length,
    requests: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      amount: formatIdr(r.amount),
      amountRaw: r.amount.toString(),
      brandName: r.brand?.name ?? null,
      requestedBy: r.requestedBy.name?.trim() || r.requestedBy.email || "—",
      submittedAt: r.createdAt.toISOString(),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Batch modul                                                                */
/* -------------------------------------------------------------------------- */

export async function aiGetSchedule(
  role: AiApiRole,
  params?: { daysAhead?: number; limit?: number },
) {
  if (!canViewSchedule(role)) {
    return accessDenied("Akses jadwal tidak tersedia untuk peran ini.");
  }

  const days = Math.min(params?.daysAhead ?? 7, 30);
  const limit = Math.min(params?.limit ?? 30, 50);
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  const events = await prisma.scheduleEvent.findMany({
    where: { startsAt: { gte: now, lte: end } },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      startsAt: true,
      recurrence: true,
      createdBy: { select: { name: true, email: true } },
      participants: {
        select: { user: { select: { name: true, email: true } } },
        take: 8,
      },
    },
    orderBy: { startsAt: "asc" },
    take: limit,
  });

  return {
    accessible: true as const,
    daysAhead: days,
    count: events.length,
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      startsAt: e.startsAt.toISOString(),
      startsAtLabel: format(e.startsAt, "EEE d MMM yyyy HH:mm", {
        locale: idLocale,
      }),
      recurrence: e.recurrence,
      createdBy: e.createdBy.name?.trim() || e.createdBy.email || "—",
      participants: e.participants.map(
        (p) => p.user.name?.trim() || p.user.email || "—",
      ),
    })),
  };
}

export async function aiGetAttendanceSummary(role: AiApiRole, date?: string) {
  if (!canViewAttendance(role)) {
    return accessDenied("Akses rekap absensi tidak tersedia untuk peran ini.");
  }

  const targetDate = date?.trim() || getTodayDateString();
  const [records, totalUsers] = await Promise.all([
    prisma.attendance.findMany({
      where: { date: targetDate },
      select: {
        type: true,
        timestamp: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { timestamp: "asc" },
    }),
    prisma.user.count(),
  ]);

  const byUser = new Map<
    string,
    {
      name: string;
      role: string;
      checkIn: string | null;
      checkOut: string | null;
      sick: boolean;
      permission: boolean;
    }
  >();

  for (const r of records) {
    const key = r.user.id;
    const existing = byUser.get(key) ?? {
      name: r.user.name?.trim() || r.user.email || "—",
      role: r.user.role,
      checkIn: null,
      checkOut: null,
      sick: false,
      permission: false,
    };
    const time = format(r.timestamp, "HH:mm");
    if (r.type === "CHECK_IN") existing.checkIn = time;
    if (r.type === "CHECK_OUT") existing.checkOut = time;
    if (r.type === "SICK") existing.sick = true;
    if (r.type === "PERMISSION") existing.permission = true;
    byUser.set(key, existing);
  }

  const statuses = [...byUser.values()].map((u) => {
    let status: "PRESENT" | "DONE" | "SICK" | "PERMISSION" = "PRESENT";
    if (u.sick) status = "SICK";
    else if (u.permission) status = "PERMISSION";
    else if (u.checkOut) status = "DONE";
    return { ...u, status };
  });

  const checkInCount = statuses.filter((s) => s.checkIn).length;
  const sickCount = statuses.filter((s) => s.status === "SICK").length;
  const permissionCount = statuses.filter((s) => s.status === "PERMISSION").length;
  const absentEstimate = Math.max(0, totalUsers - statuses.length);

  return {
    accessible: true as const,
    date: targetDate,
    summary: {
      totalUsers,
      recordedToday: statuses.length,
      checkIn: checkInCount,
      sick: sickCount,
      permission: permissionCount,
      absentEstimate,
    },
    employees: statuses.slice(0, 50),
  };
}

export async function aiGetFinanceSummary(
  role: AiApiRole,
  params?: { year?: number; month?: number },
) {
  if (!canViewFinanceSummary(role)) {
    return accessDenied("Akses ringkasan finance tidak tersedia untuk peran ini.");
  }

  const now = new Date();
  const period = {
    year: params?.year ?? now.getFullYear(),
    month: params?.month ?? now.getMonth() + 1,
  };

  const [dashboard, pendingSpendCount] = await Promise.all([
    loadFinanceDashboard(period),
    prisma.financeSpendRequest.count({
      where: { status: FinanceSpendRequestStatus.SUBMITTED },
    }),
  ]);

  return {
    accessible: true as const,
    period,
    kpis: {
      revenue: {
        current: formatIdr(dashboard.kpis.revenue.current),
        previous: formatIdr(dashboard.kpis.revenue.previous),
        deltaPct: dashboard.kpis.revenue.deltaPct,
      },
      expense: {
        current: formatIdr(dashboard.kpis.expense.current),
        previous: formatIdr(dashboard.kpis.expense.previous),
        deltaPct: dashboard.kpis.expense.deltaPct,
      },
      net: {
        current: formatIdr(dashboard.kpis.net.current),
        previous: formatIdr(dashboard.kpis.net.previous),
        deltaPct: dashboard.kpis.net.deltaPct,
      },
      cash: {
        current: formatIdr(dashboard.kpis.cash.current),
        inflow: formatIdr(dashboard.kpis.cash.inflow),
        outflow: formatIdr(dashboard.kpis.cash.outflow),
        deltaPct: dashboard.kpis.cash.deltaPct,
      },
      cashAndBank: formatIdr(dashboard.kpis.cashAndBank),
    },
    aging: {
      apOverdueCount: dashboard.aging.apOverdueCount,
      apOverdueTotal: formatIdr(dashboard.aging.apOverdueTotal),
      arOverdueCount: dashboard.aging.arOverdueCount,
      arOverdueTotal: formatIdr(dashboard.aging.arOverdueTotal),
      dueSoonCount: dashboard.alerts.dueSoonCount,
    },
    pendingSpendApprovals: pendingSpendCount,
    alerts: dashboard.alerts,
  };
}

/* -------------------------------------------------------------------------- */
/* Dokumen & Wiki                                                             */
/* -------------------------------------------------------------------------- */

async function resolveRoomIdForSearch(
  role: AiApiRole,
  roomNameOrId?: string,
) {
  const user = await agentUserForOperational(role);
  if (!user) return { ok: false as const, error: "Akses ruangan tidak tersedia." };

  if (!roomNameOrId?.trim()) return { ok: true as const, roomId: undefined };

  const rooms = await listAgentRooms(user);
  const resolved = resolveRoomFromQuery(rooms, roomNameOrId);
  if (!resolved.ok) return { ok: false as const, error: resolved.error };
  return { ok: true as const, roomId: resolved.room.id, roomName: resolved.room.name };
}

export async function aiSearchWiki(
  role: AiApiRole,
  params: { q: string; roomNameOrId?: string; limit?: number },
) {
  if (!canViewRoomsWiki(role)) {
    return accessDenied("Akses wiki ruangan tidak tersedia untuk peran ini.");
  }

  const q = params.q.trim();
  if (!q) {
    return { accessible: false as const, message: "Parameter q wajib diisi.", data: null };
  }

  const room = await resolveRoomIdForSearch(role, params.roomNameOrId);
  if (!room.ok) {
    return { accessible: false as const, message: room.error, data: null };
  }

  const limit = Math.min(params.limit ?? 15, 30);
  const pages = await prisma.roomWikiPage.findMany({
    where: {
      ...(room.roomId ? { view: { roomId: room.roomId } } : {}),
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true,
      view: {
        select: {
          title: true,
          room: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return {
    accessible: true as const,
    query: q,
    roomName: room.roomName ?? null,
    count: pages.length,
    pages: pages.map((p) => ({
      id: p.id,
      title: p.title,
      viewTitle: p.view.title,
      roomId: p.view.room.id,
      roomName: p.view.room.name,
      excerpt: p.content.replace(/\s+/g, " ").trim().slice(0, 240),
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
}

export async function aiGetWikiPage(role: AiApiRole, pageId: string) {
  if (!canViewRoomsWiki(role)) {
    return accessDenied("Akses wiki ruangan tidak tersedia untuk peran ini.");
  }

  const page = await prisma.roomWikiPage.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true,
      view: {
        select: {
          title: true,
          room: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!page) {
    return { accessible: false as const, message: "Halaman wiki tidak ditemukan.", data: null };
  }

  const maxLen = 12000;
  const content =
    page.content.length > maxLen
      ? `${page.content.slice(0, maxLen)}\n\n…(dipotong)`
      : page.content;

  return {
    accessible: true as const,
    page: {
      id: page.id,
      title: page.title,
      viewTitle: page.view.title,
      roomId: page.view.room.id,
      roomName: page.view.room.name,
      content,
      updatedAt: page.updatedAt.toISOString(),
    },
  };
}

export async function aiSearchDocuments(
  role: AiApiRole,
  params: { q: string; roomNameOrId?: string; limit?: number },
) {
  if (!canViewRoomsWiki(role)) {
    return accessDenied("Akses dokumen ruangan tidak tersedia untuk peran ini.");
  }

  const q = params.q.trim();
  if (!q) {
    return { accessible: false as const, message: "Parameter q wajib diisi.", data: null };
  }

  const room = await resolveRoomIdForSearch(role, params.roomNameOrId);
  if (!room.ok) {
    return { accessible: false as const, message: room.error, data: null };
  }

  const limit = Math.min(params.limit ?? 20, 40);
  const docs = await prisma.roomDocument.findMany({
    where: {
      ...(room.roomId ? { roomId: room.roomId } : {}),
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { fileName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      size: true,
      tags: true,
      createdAt: true,
      room: { select: { id: true, name: true } },
      folder: { select: { name: true } },
      uploadedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    accessible: true as const,
    query: q,
    roomName: room.roomName ?? null,
    count: docs.length,
    documents: docs.map((d) => ({
      id: d.id,
      title: d.title || d.fileName,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.size,
      tags: d.tags,
      folderName: d.folder?.name ?? null,
      roomId: d.room.id,
      roomName: d.room.name,
      uploadedBy: d.uploadedBy.name?.trim() || d.uploadedBy.email || "—",
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

export type { TaskPriority, TaskStatus };
