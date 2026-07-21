import {
  FinanceLedgerType,
  RoomTimelineStatus,
  TaskStatus,
} from "@prisma/client";
import { format, subDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { getUpcomingDeadlines } from "@/lib/agent/analytics";
import { getTodayDateString } from "@/lib/attendance";
import {
  computeCriticalStockSkus,
  computeOutgoingByBrand,
  computePipelineMilestoneSnapshot,
} from "@/lib/ai-api/executive-metrics";
import { aiGetUsersTaskOverview } from "@/lib/ai-api/user-tasks";
import { loadFinanceDashboard } from "@/lib/finance-dashboard";
import {
  formatIdr,
  signedBalanceForAccount,
  zeroDecimal,
} from "@/lib/finance-money";
import {
  formatMilestoneNode,
  groupProjectsByCurrentMilestone,
  loadBrandProjectsWithMilestones,
  PIPELINE_PROGRESS_NOTE,
  PROJECT_MILESTONE_SELECT,
  summarizeProjectMilestones,
} from "@/lib/ai-api/pipeline-milestones";
import { buildMilestoneTree, seedDefaultProjectMilestones } from "@/lib/project-milestones";
import { PIPELINE_LABELS } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";
import { getStockHealth } from "@/lib/stock-status";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import type { AiApiRole } from "./auth";
import {
  canViewApprovals,
  canViewAttendance,
  canViewBrandPipeline,
  canViewExecutive,
  canViewFinanceSummary,
  canViewInventory,
  canViewOrgUsers,
  canViewResearchHub,
  canViewTasks,
} from "./auth";
import {
  getKpiOverview,
  getOverdueTasks,
} from "./queries";
import { createAiApiAgentUser } from "./service-user";
import {
  aiGetAttendanceSummary,
  aiListPendingFinanceSpend,
  aiListPendingPipelineApprovals,
  aiListPendingTaskApprovals,
} from "./extended-queries";

function denied(message: string) {
  return { accessible: false as const, message, data: null };
}

/* -------------------------------------------------------------------------- */
/* Executive & komersial                                                      */
/* -------------------------------------------------------------------------- */

export async function aiGetCompanyExecutiveBriefing(role: AiApiRole) {
  if (!canViewExecutive(role)) {
    return denied("Executive briefing hanya untuk CEO/Administrator.");
  }

  const now = new Date();
  const period = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const user = createAiApiAgentUser(role);

  const [
    kpi,
    overdueTop,
    deadlines,
    pendingTasks,
    pendingPipeline,
    pendingFinance,
    attendance,
    pipeline,
    outgoing,
    criticalStock,
    financeDash,
    blockedCount,
  ] = await Promise.all([
    getKpiOverview(role),
    getOverdueTasks(role, 5),
    canViewTasks(role)
      ? getUpcomingDeadlines(user, { daysAhead: 7, limit: 8 })
      : Promise.resolve({ daysAhead: 7, count: 0, tasks: [] }),
    canViewApprovals(role)
      ? aiListPendingTaskApprovals(role, 5)
      : Promise.resolve(null),
    canViewApprovals(role)
      ? aiListPendingPipelineApprovals(role, 5)
      : Promise.resolve(null),
    canViewFinanceSummary(role)
      ? aiListPendingFinanceSpend(role, 5)
      : Promise.resolve(null),
    canViewAttendance(role)
      ? aiGetAttendanceSummary(role)
      : Promise.resolve(null),
    computePipelineMilestoneSnapshot(8),
    computeOutgoingByBrand(90),
    computeCriticalStockSkus(8),
    canViewFinanceSummary(role)
      ? loadFinanceDashboard(period)
      : Promise.resolve(null),
    canViewTasks(role)
      ? prisma.task.count({
          where: { status: TaskStatus.BLOCKED, archivedAt: null },
        })
      : Promise.resolve(0),
  ]);

  const highlights: string[] = [];
  if ((kpi.overdueTasks ?? 0) > 0) {
    highlights.push(`${kpi.overdueTasks} tugas overdue — perlu eskalasi.`);
  }
  if ((kpi.criticalStockCount ?? 0) > 0) {
    highlights.push(`${kpi.criticalStockCount} SKU stok kritis.`);
  }
  if ((kpi.pendingTaskApprovals ?? 0) > 0) {
    highlights.push(`${kpi.pendingTaskApprovals} tugas menunggu approval CEO.`);
  }
  if ((kpi.pendingPipelineApprovals ?? 0) > 0) {
    highlights.push(
      `${kpi.pendingPipelineApprovals} proyek menunggu approval pipeline.`,
    );
  }
  if ((kpi.pendingFinanceSpendApprovals ?? 0) > 0) {
    highlights.push(
      `${kpi.pendingFinanceSpendApprovals} pengajuan pengeluaran menunggu approval.`,
    );
  }
  if (pipeline.readyForLaunchCount > 0) {
    highlights.push(
      `${pipeline.readyForLaunchCount} proyek milestone 100% (siap launch).`,
    );
  }
  if (pipeline.withBlockedMilestones > 0) {
    highlights.push(
      `${pipeline.withBlockedMilestones} proyek punya milestone utama terhambat.`,
    );
  }
  if (highlights.length === 0) {
    highlights.push("Tidak ada alert kritis utama saat ini.");
  }

  return {
    accessible: true as const,
    generatedAt: now.toISOString(),
    highlights,
    kpi,
    operations: {
      overdueSample: overdueTop,
      deadlinesNext7Days: deadlines,
      blockedTasksCount: blockedCount,
    },
    approvals: {
      tasks: pendingTasks?.accessible ? pendingTasks.tasks.slice(0, 5) : null,
      pipeline: pendingPipeline?.accessible
        ? pendingPipeline.projects.slice(0, 5)
        : null,
      financeSpend: pendingFinance?.accessible
        ? pendingFinance.requests.slice(0, 5)
        : null,
    },
    pipeline: {
      progressModel: PIPELINE_PROGRESS_NOTE,
      avgMilestoneProgressPct: pipeline.avgMilestoneProgressPct,
      completedCount: pipeline.completedCount,
      needsAttentionCount: pipeline.needsAttentionCount,
      withBlockedMilestones: pipeline.withBlockedMilestones,
      readyForLaunchCount: pipeline.readyForLaunchCount,
      topProjects: pipeline.projects.slice(0, 5),
    },
    commercial: {
      outgoing90Days: outgoing.brands.slice(0, 6),
    },
    inventory: criticalStock,
    people:
      attendance && "summary" in attendance ? attendance.summary : null,
    finance: financeDash
      ? {
          period,
          revenue: formatIdr(financeDash.kpis.revenue.current),
          expense: formatIdr(financeDash.kpis.expense.current),
          net: formatIdr(financeDash.kpis.net.current),
          apOverdueCount: financeDash.alerts.overdueApCount,
          arOverdueCount: financeDash.alerts.overdueArCount,
        }
      : null,
  };
}

export async function aiGetSalesOutgoingByBrand(
  role: AiApiRole,
  days = 90,
) {
  if (!canViewExecutive(role) && !canViewInventory(role)) {
    return denied("Akses data outgoing/sales tidak tersedia untuk peran ini.");
  }

  const windowDays = Math.min(Math.max(days, 7), 365);
  const data = await computeOutgoingByBrand(windowDays);
  return { accessible: true as const, ...data };
}

/* -------------------------------------------------------------------------- */
/* Brand & pipeline                                                           */
/* -------------------------------------------------------------------------- */

export async function aiListBrands(role: AiApiRole) {
  if (!canViewBrandPipeline(role)) {
    return denied("Akses daftar brand tidak tersedia untuk peran ini.");
  }

  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { products: true, projects: true, rooms: true } },
    },
  });

  return {
    accessible: true as const,
    count: brands.length,
    brands: brands.map((b) => ({
      id: b.id,
      name: b.name,
      productCount: b._count.products,
      projectCount: b._count.projects,
      roomCount: b._count.rooms,
    })),
  };
}

export async function aiListProjectsByPipelineStage(role: AiApiRole) {
  if (!canViewBrandPipeline(role)) {
    return denied("Akses pipeline proyek tidak tersedia untuk peran ini.");
  }

  const projects = await loadBrandProjectsWithMilestones();

  const rows = projects.map((p) => {
    const summary = summarizeProjectMilestones(p.milestones);
    return {
      id: p.id,
      name: p.name,
      brandName: p.brand?.name ?? "—",
      roomName: p.room.name,
      progressPct: summary.progressPct,
      topLevelDone: summary.topLevelDone,
      topLevelTotal: summary.topLevelTotal,
      inProgressCount: summary.inProgressCount,
      blockedCount: summary.blockedCount,
      currentMilestone: summary.currentMilestone,
      nextMilestone: summary.nextMilestone,
    };
  });

  const total = rows.length;
  const avgProgressPct =
    total > 0
      ? Math.round(rows.reduce((s, r) => s + r.progressPct, 0) / total)
      : 0;

  return {
    accessible: true as const,
    progressModel: PIPELINE_PROGRESS_NOTE,
    summary: {
      totalProjects: total,
      avgProgressPct,
      completedCount: rows.filter((r) => r.progressPct >= 100).length,
      needsAttentionCount: rows.filter((r) => r.progressPct < 50).length,
      withBlockedMilestones: rows.filter((r) => r.blockedCount > 0).length,
    },
    projects: rows.sort(
      (a, b) => b.progressPct - a.progressPct || a.name.localeCompare(b.name),
    ),
    byCurrentMilestone: groupProjectsByCurrentMilestone(rows).map((g) => ({
      milestoneTitle: g.milestoneTitle,
      count: g.count,
      projectIds: g.projects.map((p) => p.id),
      projects: g.projects.map((p) => ({
        id: p.id,
        name: p.name,
        brandName: p.brandName,
        progressPct: p.progressPct,
      })),
    })),
  };
}

export async function aiGetProjectDetail(role: AiApiRole, projectId: string) {
  if (!canViewBrandPipeline(role)) {
    return denied("Akses detail proyek tidak tersedia untuk peran ini.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      currentStage: true,
      pendingPipelineStage: true,
      pipelineStageRequestedAt: true,
      stageEnteredAt: true,
      totalProgress: true,
      brand: { select: { id: true, name: true } },
      room: { select: { id: true, name: true } },
      milestones: {
        select: PROJECT_MILESTONE_SELECT,
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      },
      tasks: {
        where: { archivedAt: null },
        select: { id: true, title: true, status: true },
        take: 20,
      },
    },
  });

  if (!project) {
    return denied("Proyek tidak ditemukan.");
  }

  if (project.milestones.length === 0) {
    await seedDefaultProjectMilestones(prisma, project.id);
    project.milestones = await prisma.projectMilestone.findMany({
      where: { projectId: project.id },
      select: PROJECT_MILESTONE_SELECT,
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
    });
  }

  const summary = summarizeProjectMilestones(project.milestones);
  const milestoneTree = buildMilestoneTree(project.milestones).map(
    formatMilestoneNode,
  );

  return {
    accessible: true as const,
    progressModel: PIPELINE_PROGRESS_NOTE,
    project: {
      id: project.id,
      name: project.name,
      brandName: project.brand?.name ?? null,
      roomName: project.room.name,
      progress: {
        pct: summary.progressPct,
        topLevelDone: summary.topLevelDone,
        topLevelTotal: summary.topLevelTotal,
        subMilestoneCount: summary.subMilestoneCount,
        inProgressCount: summary.inProgressCount,
        blockedCount: summary.blockedCount,
      },
      currentMilestone: summary.currentMilestone,
      nextMilestone: summary.nextMilestone,
      milestoneTree,
      activeTasks: project.tasks,
      legacyStageApproval: {
        note: "Field legacy untuk approval CEO pindah tahap enum — progress utama di UI dihitung dari milestone.",
        currentStage: project.currentStage,
        currentStageLabel: PIPELINE_LABELS[project.currentStage],
        pendingPipelineStage: project.pendingPipelineStage,
        pendingStageLabel: project.pendingPipelineStage
          ? PIPELINE_LABELS[project.pendingPipelineStage]
          : null,
        pipelineStageRequestedAt:
          project.pipelineStageRequestedAt?.toISOString() ?? null,
        stageEnteredAt: project.stageEnteredAt.toISOString(),
        totalProgress: project.totalProgress,
      },
    },
  };
}

export async function aiListStuckProjects(role: AiApiRole, minDaysStalled = 45) {
  if (!canViewBrandPipeline(role)) {
    return denied("Akses proyek macet tidak tersedia untuk peran ini.");
  }

  const threshold = Math.max(minDaysStalled, 7);
  const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);
  const projects = await loadBrandProjectsWithMilestones();
  const now = Date.now();

  const stuck = projects
    .map((p) => {
      const summary = summarizeProjectMilestones(p.milestones);
      const tops = p.milestones.filter((m) => !m.parentId);
      const blockedRoots = tops.filter(
        (m) => m.status === RoomTimelineStatus.BLOCKED,
      );
      const stalledInProgress = tops.filter(
        (m) =>
          m.status === RoomTimelineStatus.IN_PROGRESS &&
          m.updatedAt <= cutoff,
      );
      const reasons: string[] = [];
      if (blockedRoots.length > 0) {
        reasons.push(`${blockedRoots.length} milestone utama terhambat`);
      }
      if (stalledInProgress.length > 0) {
        reasons.push(
          `${stalledInProgress.length} milestone berjalan tanpa update ≥${threshold} hari`,
        );
      }

      if (reasons.length === 0) return null;

      const oldestStalledAt = [...blockedRoots, ...stalledInProgress]
        .map((m) => m.updatedAt.getTime())
        .sort((a, b) => a - b)[0];

      return {
        id: p.id,
        name: p.name,
        brandName: p.brand?.name ?? "—",
        roomName: p.room.name,
        progressPct: summary.progressPct,
        currentMilestone: summary.currentMilestone,
        reasons,
        daysSinceLastMilestoneUpdate: oldestStalledAt
          ? Math.floor((now - oldestStalledAt) / (24 * 60 * 60 * 1000))
          : null,
        blockedMilestones: blockedRoots.map((m) => ({
          id: m.id,
          title: m.title,
          updatedAt: m.updatedAt.toISOString(),
        })),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort(
      (a, b) =>
        (b.daysSinceLastMilestoneUpdate ?? 0) -
        (a.daysSinceLastMilestoneUpdate ?? 0),
    )
    .slice(0, 20);

  return {
    accessible: true as const,
    progressModel: PIPELINE_PROGRESS_NOTE,
    minDaysStalled: threshold,
    count: stuck.length,
    projects: stuck,
  };
}

/* -------------------------------------------------------------------------- */
/* Logistik                                                                   */
/* -------------------------------------------------------------------------- */

export async function aiListProducts(role: AiApiRole, limit = 50) {
  if (!canViewInventory(role)) {
    return denied("Akses katalog produk tidak tersedia untuk peran ini.");
  }

  const cap = Math.min(limit, 100);
  const products = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      currentStock: true,
      minStock: true,
      brand: { select: { name: true } },
    },
    orderBy: [{ currentStock: "asc" }, { name: "asc" }],
    take: cap,
  });

  return {
    accessible: true as const,
    count: products.length,
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brandName: p.brand.name,
      currentStock: p.currentStock,
      minStock: p.minStock,
      health: getStockHealth(p.currentStock, p.minStock),
    })),
  };
}

export async function aiListVendors(role: AiApiRole, limit = 30) {
  if (!canViewInventory(role)) {
    return denied("Akses vendor tidak tersedia untuk peran ini.");
  }

  const vendors = await prisma.vendor.findMany({
    select: {
      id: true,
      name: true,
      picName: true,
      contact: true,
      specialty: true,
    },
    orderBy: { name: "asc" },
    take: Math.min(limit, 50),
  });

  return { accessible: true as const, count: vendors.length, vendors };
}

/* -------------------------------------------------------------------------- */
/* Finance drill-down                                                         */
/* -------------------------------------------------------------------------- */

export async function aiGetApArAging(role: AiApiRole) {
  if (!canViewFinanceSummary(role)) {
    return denied("Akses AP/AR aging tidak tersedia untuk peran ini.");
  }

  const now = new Date();
  const period = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const dash = await loadFinanceDashboard(period);

  return {
    accessible: true as const,
    asOf: now.toISOString(),
    ap: {
      totalOutstanding: formatIdr(dash.aging.apTotal),
      overdueCount: dash.aging.apOverdueCount,
      overdueTotal: formatIdr(dash.aging.apOverdueTotal),
      topItems: dash.aging.ap.slice(0, 10).map((r) => ({
        vendorName: r.vendorName,
        billNumber: r.billNumber,
        dueDate: r.dueDate?.toISOString() ?? null,
        remaining: formatIdr(r.remaining),
        status: r.status.kind,
      })),
    },
    ar: {
      totalOutstanding: formatIdr(dash.aging.arTotal),
      overdueCount: dash.aging.arOverdueCount,
      overdueTotal: formatIdr(dash.aging.arOverdueTotal),
      topItems: dash.aging.ar.slice(0, 10).map((r) => ({
        customerName: r.customerName,
        invoiceNumber: r.invoiceNumber,
        dueDate: r.dueDate?.toISOString() ?? null,
        remaining: formatIdr(r.remaining),
        status: r.status.kind,
      })),
    },
    dueSoonCount: dash.alerts.dueSoonCount,
  };
}

export async function aiGetBudgetVsActual(
  role: AiApiRole,
  params?: { year?: number; month?: number },
) {
  if (!canViewFinanceSummary(role)) {
    return denied("Akses budget vs aktual tidak tersedia untuk peran ini.");
  }

  const now = new Date();
  const year = params?.year ?? now.getFullYear();
  const month = params?.month ?? now.getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const budgets = await prisma.financeBudgetLine.findMany({
    where: { year, month },
    include: { brand: true, account: true },
  });

  const lines = await prisma.financeJournalLine.findMany({
    where: {
      entry: { status: "POSTED", entryDate: { gte: start, lte: end } },
      account: { type: FinanceLedgerType.EXPENSE },
    },
    include: { account: true },
  });

  const rows = budgets.map((b) => {
    let actual = zeroDecimal();
    for (const ln of lines) {
      if (b.accountId && ln.accountId !== b.accountId) continue;
      if (b.brandId && ln.brandId !== b.brandId) continue;
      actual = actual.plus(
        signedBalanceForAccount(ln.account.type, ln.debitBase, ln.creditBase),
      );
    }
    const label = [
      b.account?.code ?? "SEMUA_BEBAN",
      b.brand?.name ?? "Semua brand",
    ].join(" · ");
    return {
      budgetId: b.id,
      label,
      limit: formatIdr(b.amountLimit),
      actual: formatIdr(actual),
      variance: formatIdr(b.amountLimit.minus(actual)),
      overBudget: actual.greaterThan(b.amountLimit),
    };
  });

  return {
    accessible: true as const,
    period: { year, month },
    count: rows.length,
    rows,
  };
}

/* -------------------------------------------------------------------------- */
/* People & kapasitas                                                         */
/* -------------------------------------------------------------------------- */

export async function aiGetBlockedTasksSummary(role: AiApiRole, limit = 25) {
  if (!canViewTasks(role)) {
    return denied("Akses tugas blocked tidak tersedia untuk peran ini.");
  }

  const tasks = await prisma.task.findMany({
    where: { status: TaskStatus.BLOCKED, archivedAt: null },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
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
    take: Math.min(limit, 50),
  });

  return {
    accessible: true as const,
    totalBlocked: tasks.length,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      contextLabel: taskProjectContextLabel(t.project),
      roomName: t.project.room.name,
      assignees: t.assignees.map(
        (a) => a.user.name?.trim() || a.user.email || "—",
      ),
    })),
  };
}

export async function aiGetTeamWorkloadSummary(role: AiApiRole, limit = 15) {
  const overview = await aiGetUsersTaskOverview(role, {
    includeTaskTitles: true,
    tasksPerUser: 5,
    limit: Math.min(limit, 30),
    activeOnly: true,
  });

  if (!overview.accessible) {
    return overview;
  }

  return {
    accessible: true as const,
    note: "Ringkasan tugas aktif per PIC. Gunakan get_user_tasks untuk daftar lengkap satu orang.",
    totalUsersWithTasks: overview.totalUsersWithTasks,
    unassignedActiveTasks: overview.unassignedActiveTasks,
    users: overview.users.map((u) => ({
      userId: u.userId,
      name: u.name,
      email: u.email,
      activeCount: u.activeCount,
      overdue: u.overdue,
      blocked: u.blocked,
      inProgress: u.inProgress,
      inReview: u.inReview,
      todo: u.todo,
      sampleTasks: u.tasks ?? [],
    })),
  };
}

export async function aiGetAttendanceWeeklyTrend(role: AiApiRole) {
  if (!canViewAttendance(role)) {
    return denied("Akses trend absensi tidak tersedia untuk peran ini.");
  }

  const days = Array.from({ length: 7 }, (_, i) =>
    format(subDays(new Date(), 6 - i), "yyyy-MM-dd"),
  );

  const records = await prisma.attendance.findMany({
    where: { date: { in: days } },
    select: { date: true, type: true, userId: true },
  });

  const totalUsers = await prisma.user.count();
  const byDate = days.map((date) => {
    const dayRecords = records.filter((r) => r.date === date);
    const uniqueUsers = new Set(dayRecords.map((r) => r.userId)).size;
    const checkIns = dayRecords.filter((r) => r.type === "CHECK_IN").length;
    const sick = dayRecords.filter((r) => r.type === "SICK").length;
    const permission = dayRecords.filter((r) => r.type === "PERMISSION").length;
    return {
      date,
      label: format(new Date(`${date}T12:00:00`), "EEE d MMM", {
        locale: idLocale,
      }),
      recordedUsers: uniqueUsers,
      checkIns,
      sick,
      permission,
      absentEstimate: Math.max(0, totalUsers - uniqueUsers),
    };
  });

  return { accessible: true as const, totalUsers, days: byDate };
}

export async function aiListOrgUsers(role: AiApiRole, limit = 40) {
  if (!canViewOrgUsers(role)) {
    return denied("Akses daftar pengguna tidak tersedia untuk peran ini.");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      whatsappPhone: true,
    },
    orderBy: { name: "asc" },
    take: Math.min(limit, 80),
  });

  return {
    accessible: true as const,
    count: users.length,
    users: users.map((u) => ({
      id: u.id,
      name: u.name?.trim() || u.email || "—",
      email: u.email,
      role: u.role,
      hasWhatsapp: Boolean(u.whatsappPhone?.trim()),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Content planning                                                           */
/* -------------------------------------------------------------------------- */

export async function aiGetContentPlanStatus(
  role: AiApiRole,
  roomNameOrId?: string,
) {
  if (!canViewBrandPipeline(role)) {
    return denied("Akses content planning tidak tersedia untuk peran ini.");
  }

  let roomFilter: { roomId?: string } = {};
  if (roomNameOrId?.trim()) {
    const user = createAiApiAgentUser(role);
    const { listAgentRooms } = await import("@/lib/agent/queries");
    const { matchAgentRoom } = await import("@/lib/agent/room-match");
    const rooms = await listAgentRooms(user);
    const match = matchAgentRoom(roomNameOrId, rooms);
    if (match.kind !== "exact" && match.kind !== "fuzzy") {
      return denied(`Ruangan "${roomNameOrId}" tidak ditemukan.`);
    }
    roomFilter = { roomId: match.room.id };
  }

  const items = await prisma.roomContentPlanItem.findMany({
    where: roomFilter,
    select: {
      id: true,
      konten: true,
      jenisKonten: true,
      statusCopywriting: true,
      statusDesign: true,
      tanggalPosting: true,
      jamPosting: true,
      deadlineCopywriting: true,
      deadlineDesign: true,
      room: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });

  const now = new Date();
  let overduePosting = 0;
  const byRoom = new Map<
    string,
    { roomName: string; total: number; copywritingDone: number; designDone: number }
  >();

  for (const item of items) {
    const key = item.room.id;
    const row = byRoom.get(key) ?? {
      roomName: item.room.name,
      total: 0,
      copywritingDone: 0,
      designDone: 0,
    };
    row.total += 1;
    if (item.statusCopywriting === "DIPUBLIKASIKAN") row.copywritingDone += 1;
    if (item.statusDesign === "DIPUBLIKASIKAN") row.designDone += 1;
    byRoom.set(key, row);

    if (
      item.tanggalPosting &&
      item.tanggalPosting < now &&
      item.statusDesign !== "DIPUBLIKASIKAN"
    ) {
      overduePosting += 1;
    }
  }

  return {
    accessible: true as const,
    totalItems: items.length,
    overduePostingCount: overduePosting,
    byRoom: [...byRoom.values()],
    recentItems: items.slice(0, 15).map((i) => ({
      id: i.id,
      konten: i.konten.slice(0, 80),
      roomName: i.room.name,
      jenisKonten: i.jenisKonten,
      statusCopywriting: i.statusCopywriting,
      statusDesign: i.statusDesign,
      tanggalPosting: i.tanggalPosting?.toISOString() ?? null,
      jamPosting: i.jamPosting,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Meta                                                                       */
/* -------------------------------------------------------------------------- */

export function aiGetMcpCapabilities(role: AiApiRole) {
  return {
    accessible: true as const,
    role,
    modules: {
      executiveBriefing: canViewExecutive(role),
      salesOutgoing: canViewExecutive(role) || canViewInventory(role),
      brandPipeline: canViewBrandPipeline(role),
      tasksKanban: canViewTasks(role),
      userTasks: canViewTasks(role),
      inventory: canViewInventory(role),
      ceoApprovals: canViewApprovals(role),
      finance: canViewFinanceSummary(role),
      schedule: true,
      attendance: canViewAttendance(role),
      wikiDocuments: canViewBrandPipeline(role) || canViewTasks(role),
      orgUsers: canViewOrgUsers(role),
      contentPlanning: canViewBrandPipeline(role),
      researchHub: canViewResearchHub(role),
    },
    note: "Semua tool read-only. Gunakan header x-dcc-role untuk simulasi peran.",
  };
}

/* -------------------------------------------------------------------------- */
/* Company risk rollup                                                        */
/* -------------------------------------------------------------------------- */

type RiskSeverity = "critical" | "high" | "medium";

type RiskItem = {
  id?: string;
  label: string;
  note?: string;
  context?: string | null;
  assignees?: string[];
};

type RiskEntry = {
  category: "inventory" | "tasks" | "projects" | "finance" | "approvals";
  severity: RiskSeverity;
  title: string;
  count: number;
  detail?: string;
  items?: RiskItem[];
};

/**
 * Rollup risiko lintas modul dalam satu daftar terprioritas — "apa yang perlu
 * perhatian sekarang". Menyusun ulang query yang sudah ada (overdue, blocked,
 * stuck projects, stok kritis, AP/AR overdue, approval menua) tanpa data baru.
 */
export async function aiGetCompanyRisks(role: AiApiRole) {
  if (!canViewExecutive(role)) {
    return denied("Company risks hanya untuk CEO/Administrator.");
  }

  const now = Date.now();
  const APPROVAL_AGING_DAYS = 3;
  const daysSince = (iso: string | null | undefined) =>
    iso ? Math.floor((now - new Date(iso).getTime()) / 86_400_000) : null;

  const [
    kpi,
    overdue,
    blocked,
    stuck,
    criticalStock,
    apar,
    pendingTasks,
    pendingFinance,
  ] = await Promise.all([
    getKpiOverview(role),
    getOverdueTasks(role, 8),
    aiGetBlockedTasksSummary(role, 8),
    aiListStuckProjects(role),
    computeCriticalStockSkus(8),
    aiGetApArAging(role),
    aiListPendingTaskApprovals(role, 15),
    aiListPendingFinanceSpend(role, 15),
  ]);

  const risks: RiskEntry[] = [];

  // Stok kritis
  if (criticalStock.criticalCount > 0) {
    risks.push({
      category: "inventory",
      severity: "critical",
      title: `${criticalStock.criticalCount} SKU stok kritis`,
      count: criticalStock.criticalCount,
      detail:
        criticalStock.lowCount > 0
          ? `+${criticalStock.lowCount} SKU stok rendah`
          : undefined,
      items: criticalStock.items.slice(0, 5).map((i) => ({
        id: i.id,
        label: `${i.name} (${i.sku})`,
        note: `stok ${i.currentStock}/${i.minStock}`,
        context: i.brandName,
      })),
    });
  }

  // Tugas overdue
  const overdueCount = kpi.overdueTasks ?? overdue.length;
  if (overdueCount > 0) {
    risks.push({
      category: "tasks",
      severity: overdueCount >= 10 ? "critical" : "high",
      title: `${overdueCount} tugas overdue`,
      count: overdueCount,
      items: overdue.slice(0, 5).map((t) => ({
        id: t.id,
        label: t.title,
        note: t.daysOverdue != null ? `${t.daysOverdue} hari lewat` : undefined,
        context: t.contextLabel,
        assignees: t.assignees,
      })),
    });
  }

  // Tugas terblokir
  if (blocked.accessible && blocked.totalBlocked > 0) {
    risks.push({
      category: "tasks",
      severity: "high",
      title: `${blocked.totalBlocked} tugas terblokir (BLOCKED)`,
      count: blocked.totalBlocked,
      items: blocked.tasks.slice(0, 5).map((t) => ({
        id: t.id,
        label: t.title,
        context: t.contextLabel ?? t.roomName,
        assignees: t.assignees,
      })),
    });
  }

  // Proyek macet
  if (stuck.accessible && stuck.count > 0) {
    risks.push({
      category: "projects",
      severity: "high",
      title: `${stuck.count} proyek macet`,
      count: stuck.count,
      items: stuck.projects.slice(0, 5).map((p) => ({
        id: p.id,
        label: p.name,
        note: p.reasons.join("; "),
        context: p.brandName,
      })),
    });
  }

  // AP/AR overdue
  if (apar.accessible) {
    if (apar.ap.overdueCount > 0) {
      risks.push({
        category: "finance",
        severity: "high",
        title: `${apar.ap.overdueCount} tagihan hutang (AP) overdue`,
        count: apar.ap.overdueCount,
        detail: `Total ${apar.ap.overdueTotal}`,
        items: apar.ap.topItems.slice(0, 5).map((r) => ({
          label: r.vendorName ?? r.billNumber ?? "—",
          note: `${r.remaining} · jatuh tempo ${r.dueDate?.slice(0, 10) ?? "—"}`,
        })),
      });
    }
    if (apar.ar.overdueCount > 0) {
      risks.push({
        category: "finance",
        severity: "high",
        title: `${apar.ar.overdueCount} piutang (AR) overdue`,
        count: apar.ar.overdueCount,
        detail: `Total ${apar.ar.overdueTotal}`,
        items: apar.ar.topItems.slice(0, 5).map((r) => ({
          label: r.customerName ?? r.invoiceNumber ?? "—",
          note: `${r.remaining} · jatuh tempo ${r.dueDate?.slice(0, 10) ?? "—"}`,
        })),
      });
    }
  }

  // Approval menua
  if (pendingTasks.accessible) {
    const aging = pendingTasks.tasks.filter(
      (t) => (daysSince(t.updatedAt) ?? 0) >= APPROVAL_AGING_DAYS,
    );
    if (aging.length > 0) {
      risks.push({
        category: "approvals",
        severity: "medium",
        title: `${aging.length} approval tugas menua (≥${APPROVAL_AGING_DAYS} hari)`,
        count: aging.length,
        items: aging.slice(0, 5).map((t) => ({
          id: t.id,
          label: t.title,
          note: `menunggu ${daysSince(t.updatedAt)} hari`,
          context: t.contextLabel,
        })),
      });
    }
  }
  if (pendingFinance.accessible) {
    const aging = pendingFinance.requests.filter(
      (r) => (daysSince(r.submittedAt) ?? 0) >= APPROVAL_AGING_DAYS,
    );
    if (aging.length > 0) {
      risks.push({
        category: "approvals",
        severity: "medium",
        title: `${aging.length} pengajuan pengeluaran menua (≥${APPROVAL_AGING_DAYS} hari)`,
        count: aging.length,
        items: aging.slice(0, 5).map((r) => ({
          id: r.id,
          label: r.title,
          note: `${r.amount} · menunggu ${daysSince(r.submittedAt)} hari`,
          context: r.brandName,
        })),
      });
    }
  }

  const severityRank: Record<RiskSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
  };
  risks.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] || b.count - a.count,
  );

  const bySeverity = {
    critical: risks.filter((r) => r.severity === "critical").length,
    high: risks.filter((r) => r.severity === "high").length,
    medium: risks.filter((r) => r.severity === "medium").length,
  };

  return {
    accessible: true as const,
    generatedAt: new Date().toISOString(),
    totalRisks: risks.length,
    bySeverity,
    headline:
      risks.length === 0
        ? "Tidak ada risiko kritis terdeteksi saat ini."
        : `${risks.length} area risiko — ${bySeverity.critical} kritis, ${bySeverity.high} tinggi, ${bySeverity.medium} sedang.`,
    risks,
  };
}

/* -------------------------------------------------------------------------- */
/* Brand 360 overview                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Dossier 360 satu brand: proyek + progress milestone, kesehatan tugas,
 * stok SKU brand, outgoing sales, dan ringkasan content plan. Composite
 * berbasis brand — unit natural bisnis.
 */
export async function aiGetBrandOverview(role: AiApiRole, brandNameOrId: string) {
  if (!canViewBrandPipeline(role)) {
    return denied("Akses overview brand tidak tersedia untuk peran ini.");
  }

  const query = brandNameOrId.trim();
  if (!query) return denied("brandNameOrId wajib diisi.");

  const brand = await prisma.brand.findFirst({
    where: {
      OR: [
        { id: query },
        { name: { equals: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });
  if (!brand) return denied(`Brand "${query}" tidak ditemukan.`);

  const showInventory = canViewInventory(role);

  const [projectRows, taskGroups, products, contentItems, outgoing] =
    await Promise.all([
      prisma.project.findMany({
        where: { brandId: brand.id },
        select: {
          id: true,
          name: true,
          room: { select: { name: true } },
          milestones: {
            select: PROJECT_MILESTONE_SELECT,
            orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.task.groupBy({
        by: ["status"],
        where: { archivedAt: null, project: { brandId: brand.id } },
        _count: { _all: true },
      }),
      showInventory
        ? prisma.product.findMany({
            where: { brandId: brand.id },
            select: {
              id: true,
              sku: true,
              name: true,
              currentStock: true,
              minStock: true,
            },
            orderBy: { currentStock: "asc" },
          })
        : Promise.resolve(null),
      prisma.roomContentPlanItem.findMany({
        where: { room: { brandId: brand.id } },
        select: { statusCopywriting: true, statusDesign: true, tanggalPosting: true },
      }),
      computeOutgoingByBrand(90),
    ]);

  const projects = projectRows.map((p) => {
    const summary = summarizeProjectMilestones(p.milestones);
    return {
      id: p.id,
      name: p.name,
      roomName: p.room.name,
      progressPct: summary.progressPct,
      currentMilestone: summary.currentMilestone,
      blockedCount: summary.blockedCount,
    };
  });
  const avgProgressPct =
    projects.length > 0
      ? Math.round(
          projects.reduce((s, p) => s + p.progressPct, 0) / projects.length,
        )
      : 0;

  const taskByStatus: Record<string, number> = {};
  let totalTasks = 0;
  for (const g of taskGroups) {
    taskByStatus[g.status] = g._count._all;
    totalTasks += g._count._all;
  }

  const inventory = products
    ? {
        skuCount: products.length,
        criticalCount: products.filter(
          (p) => getStockHealth(p.currentStock, p.minStock) === "CRITICAL",
        ).length,
        lowCount: products.filter(
          (p) => getStockHealth(p.currentStock, p.minStock) === "LOW",
        ).length,
        lowestStock: products.slice(0, 5).map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          currentStock: p.currentStock,
          minStock: p.minStock,
          health: getStockHealth(p.currentStock, p.minStock),
        })),
      }
    : null;

  const now = new Date();
  const contentPlan = {
    totalItems: contentItems.length,
    copywritingDone: contentItems.filter(
      (i) => i.statusCopywriting === "DIPUBLIKASIKAN",
    ).length,
    designDone: contentItems.filter((i) => i.statusDesign === "DIPUBLIKASIKAN")
      .length,
    overduePostingCount: contentItems.filter(
      (i) =>
        i.tanggalPosting &&
        i.tanggalPosting < now &&
        i.statusDesign !== "DIPUBLIKASIKAN",
    ).length,
  };

  const outgoingRow = outgoing.brands.find(
    (b) => b.brandName.trim().toLowerCase() === brand.name.trim().toLowerCase(),
  );

  return {
    accessible: true as const,
    generatedAt: new Date().toISOString(),
    brand: { id: brand.id, name: brand.name },
    projects: {
      count: projects.length,
      avgProgressPct,
      withBlockedMilestones: projects.filter((p) => p.blockedCount > 0).length,
      items: projects.slice(0, 10),
    },
    tasks: { total: totalTasks, byStatus: taskByStatus },
    inventory,
    contentPlan,
    sales: {
      windowDays: outgoing.windowDays,
      totalPcs: outgoingRow?.totalPcs ?? 0,
      salesPcs: outgoingRow?.salesPcs ?? 0,
      samplingPcs: outgoingRow?.samplingPcs ?? 0,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Recent activity feed                                                       */
/* -------------------------------------------------------------------------- */

type ActivityEvent = {
  type:
    | "task_created"
    | "task_completed"
    | "milestone_done"
    | "milestone_blocked"
    | "document_added"
    | "stock_movement"
    | "schedule_created"
    | "finance_entry";
  at: string;
  title: string;
  context?: string | null;
  actor?: string;
};

const ROOM_TIMELINE_LABEL: Partial<Record<RoomTimelineStatus, string>> = {
  [RoomTimelineStatus.DONE]: "selesai",
  [RoomTimelineStatus.BLOCKED]: "terhambat",
};

/**
 * Change feed lintas modul — "apa yang bergerak" dalam N hari terakhir.
 * Dirakit dari beberapa tabel (tidak ada audit log tunggal): tugas dibuat/
 * selesai, milestone, dokumen, pergerakan stok, jadwal, jurnal finance.
 * Setiap bagian di-gate sesuai izin peran.
 */
export async function aiGetRecentActivity(
  role: AiApiRole,
  params?: { days?: number; limit?: number },
) {
  if (!canViewExecutive(role)) {
    return denied("Recent activity hanya untuk CEO/Administrator.");
  }

  const days = Math.min(Math.max(params?.days ?? 7, 1), 30);
  const limit = Math.min(Math.max(params?.limit ?? 40, 1), 80);
  const since = new Date(Date.now() - days * 86_400_000);

  const showTasks = canViewTasks(role);
  const showPipeline = canViewBrandPipeline(role);
  const showInventory = canViewInventory(role);
  const showFinance = canViewFinanceSummary(role);

  const [
    tasksCreated,
    tasksDone,
    milestones,
    documents,
    stockLogs,
    scheduleEvents,
    financeEntries,
  ] = await Promise.all([
    showTasks
      ? prisma.task.findMany({
          where: { createdAt: { gte: since }, archivedAt: null },
          select: {
            id: true,
            title: true,
            createdAt: true,
            project: {
              select: {
                name: true,
                brand: { select: { name: true } },
                room: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
    showTasks
      ? prisma.task.findMany({
          where: { status: TaskStatus.DONE, updatedAt: { gte: since } },
          select: {
            id: true,
            title: true,
            updatedAt: true,
            project: {
              select: {
                name: true,
                brand: { select: { name: true } },
                room: { select: { name: true } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
    showPipeline
      ? prisma.projectMilestone.findMany({
          where: {
            updatedAt: { gte: since },
            parentId: null,
            status: {
              in: [RoomTimelineStatus.DONE, RoomTimelineStatus.BLOCKED],
            },
          },
          select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true,
            project: {
              select: {
                name: true,
                brand: { select: { name: true } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
    showTasks || showPipeline
      ? prisma.roomDocument.findMany({
          where: { createdAt: { gte: since } },
          select: {
            id: true,
            title: true,
            fileName: true,
            createdAt: true,
            room: { select: { name: true } },
            uploadedBy: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
    showInventory
      ? prisma.stockLog.findMany({
          where: { createdAt: { gte: since } },
          select: {
            id: true,
            type: true,
            amount: true,
            note: true,
            createdAt: true,
            product: { select: { name: true, sku: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
    prisma.scheduleEvent.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        title: true,
        startsAt: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    showFinance
      ? prisma.financeJournalEntry.findMany({
          where: { createdAt: { gte: since } },
          select: {
            id: true,
            entryNumber: true,
            memo: true,
            status: true,
            createdAt: true,
            createdBy: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
  ]);

  const actorOf = (u: { name: string | null; email: string } | null) =>
    u ? u.name?.trim() || u.email : undefined;

  const events: ActivityEvent[] = [];

  for (const t of tasksCreated) {
    events.push({
      type: "task_created",
      at: t.createdAt.toISOString(),
      title: `Tugas baru: ${t.title}`,
      context: taskProjectContextLabel(t.project),
    });
  }
  for (const t of tasksDone) {
    events.push({
      type: "task_completed",
      at: t.updatedAt.toISOString(),
      title: `Tugas selesai: ${t.title}`,
      context: taskProjectContextLabel(t.project),
    });
  }
  for (const m of milestones) {
    const isDone = m.status === RoomTimelineStatus.DONE;
    events.push({
      type: isDone ? "milestone_done" : "milestone_blocked",
      at: m.updatedAt.toISOString(),
      title: `Milestone ${ROOM_TIMELINE_LABEL[m.status] ?? "diperbarui"}: ${m.title}`,
      context: [m.project.brand?.name, m.project.name]
        .filter(Boolean)
        .join(" · "),
    });
  }
  for (const d of documents) {
    events.push({
      type: "document_added",
      at: d.createdAt.toISOString(),
      title: `Dokumen baru: ${d.title?.trim() || d.fileName}`,
      context: d.room.name,
      actor: actorOf(d.uploadedBy),
    });
  }
  for (const s of stockLogs) {
    if ((s.note ?? "").startsWith("[SYS]")) continue;
    events.push({
      type: "stock_movement",
      at: s.createdAt.toISOString(),
      title: `Stok ${s.type} ${s.amount}: ${s.product.name}`,
      context: s.product.sku,
    });
  }
  for (const e of scheduleEvents) {
    events.push({
      type: "schedule_created",
      at: e.createdAt.toISOString(),
      title: `Jadwal: ${e.title}`,
      context: `mulai ${e.startsAt.toISOString().slice(0, 16).replace("T", " ")}`,
      actor: actorOf(e.createdBy),
    });
  }
  for (const f of financeEntries) {
    events.push({
      type: "finance_entry",
      at: f.createdAt.toISOString(),
      title: `Jurnal ${f.status}: ${f.entryNumber || f.memo?.slice(0, 60) || "—"}`,
      actor: actorOf(f.createdBy),
    });
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const trimmed = events.slice(0, limit);

  const byType: Record<string, number> = {};
  for (const e of trimmed) byType[e.type] = (byType[e.type] ?? 0) + 1;

  return {
    accessible: true as const,
    generatedAt: new Date().toISOString(),
    windowDays: days,
    totalEvents: trimmed.length,
    byType,
    events: trimmed,
  };
}
