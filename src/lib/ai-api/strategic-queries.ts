import {
  FinanceLedgerType,
  RoomTimelineStatus,
  TaskStatus,
} from "@prisma/client";
import { format, subDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { getUpcomingDeadlines } from "@/lib/agent/analytics";
import { listAgentTasks } from "@/lib/agent/queries";
import { getTodayDateString } from "@/lib/attendance";
import {
  computeCriticalStockSkus,
  computeOutgoingByBrand,
  computePipelineMilestoneSnapshot,
} from "@/lib/ai-api/executive-metrics";
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
  if (!canViewExecutive(role)) {
    return denied("Ringkasan workload tim hanya untuk CEO/Administrator.");
  }

  const user = createAiApiAgentUser(role);
  const tasks = await listAgentTasks(user, { limit: 50 });

  const byAssignee = new Map<
    string,
    { name: string; overdue: number; inProgress: number; total: number }
  >();

  for (const t of tasks) {
    for (const name of t.assignees) {
      const key = name;
      const row = byAssignee.get(key) ?? {
        name,
        overdue: 0,
        inProgress: 0,
        total: 0,
      };
      row.total += 1;
      if (t.status === TaskStatus.OVERDUE) row.overdue += 1;
      if (t.status === TaskStatus.IN_PROGRESS) row.inProgress += 1;
      byAssignee.set(key, row);
    }
  }

  const ranked = [...byAssignee.values()]
    .sort((a, b) => b.overdue - a.overdue || b.total - a.total)
    .slice(0, Math.min(limit, 30));

  return {
    accessible: true as const,
    note: "Berdasarkan sampel 50 tugas aktif terbaru.",
    assignees: ranked,
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
      inventory: canViewInventory(role),
      ceoApprovals: canViewApprovals(role),
      finance: canViewFinanceSummary(role),
      schedule: true,
      attendance: canViewAttendance(role),
      wikiDocuments: canViewBrandPipeline(role) || canViewTasks(role),
      orgUsers: canViewOrgUsers(role),
      contentPlanning: canViewBrandPipeline(role),
    },
    note: "Semua tool read-only. Gunakan header x-dcc-role untuk simulasi peran.",
  };
}
