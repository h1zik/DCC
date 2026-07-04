import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import {
  aiGetApArAging,
  aiGetAttendanceWeeklyTrend,
  aiGetBlockedTasksSummary,
  aiGetBrandOverview,
  aiGetBudgetVsActual,
  aiGetCompanyExecutiveBriefing,
  aiGetCompanyRisks,
  aiGetContentPlanStatus,
  aiGetProjectDetail,
  aiGetRecentActivity,
  aiGetSalesOutgoingByBrand,
  aiGetTeamWorkloadSummary,
  aiListBrands,
  aiListOrgUsers,
  aiListProducts,
  aiListProjectsByPipelineStage,
  aiListStuckProjects,
  aiListVendors,
} from "@/lib/ai-api/strategic-queries";
import {
  aiGetAttendanceSummary,
  aiGetFinanceSummary,
  aiGetSchedule,
  aiGetWikiPage,
  aiListPendingFinanceSpend,
  aiListPendingPipelineApprovals,
  aiListPendingTaskApprovals,
  aiSearchWiki,
} from "@/lib/ai-api/extended-queries";
import {
  aiGetRoomDocumentContent,
  aiListRoomDocuments,
  aiSearchDocuments,
} from "@/lib/ai-api/room-documents";
import {
  aiGetUserTasks,
  aiGetUsersTaskOverview,
} from "@/lib/ai-api/user-tasks";
import { userRoleToAiRole } from "./queries";
import type { AgentToolResult, AgentUser } from "./types";

/**
 * Tool baca lintas-perusahaan untuk agent internal.
 * Membungkus query src/lib/ai-api yang sudah dipakai MCP eksternal —
 * setiap query melakukan gating peran sendiri (soft-denial `accessible:false`),
 * jadi executor ini cukup memetakan UserRole → AiApiRole.
 */
export const COMPANY_AGENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_company_executive_briefing",
    description:
      "Briefing eksekutif menyeluruh: finance bulan berjalan, pipeline, tugas, risiko. Untuk 'gimana kondisi perusahaan?'. Hanya CEO/Administrator.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_company_risks",
    description:
      "Daftar risiko perusahaan terdeteksi: proyek macet, tugas blocked, budget overrun, stok kritis.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_recent_activity",
    description: "Aktivitas terbaru lintas modul (tugas, proyek, dokumen).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        days: { type: SchemaType.NUMBER, description: "Rentang hari ke belakang" },
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: "get_sales_outgoing_by_brand",
    description:
      "Penjualan/outgoing stok per brand dalam N hari terakhir (default 90).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        days: { type: SchemaType.NUMBER, description: "Default 90" },
      },
    },
  },
  {
    name: "list_brands",
    description: "Daftar brand perusahaan.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_brand_overview",
    description:
      "Ringkasan satu brand: produk, proyek pipeline, room, aktivitas. Pakai nama brand.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        brandNameOrId: { type: SchemaType.STRING, description: "Nama brand" },
      },
      required: ["brandNameOrId"],
    },
  },
  {
    name: "list_products",
    description: "Katalog produk internal (bukan produk kompetitor).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { limit: { type: SchemaType.NUMBER, description: "Default 50" } },
    },
  },
  {
    name: "list_vendors",
    description: "Daftar vendor/supplier.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { limit: { type: SchemaType.NUMBER, description: "Default 30" } },
    },
  },
  {
    name: "list_projects_by_pipeline_stage",
    description:
      "Proyek pipeline produk dikelompokkan per tahap (7 tahap). Untuk 'pipeline kita gimana?'.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_project_detail",
    description: "Detail proyek pipeline: milestone, progres, room terkait.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        projectId: { type: SchemaType.STRING },
      },
      required: ["projectId"],
    },
  },
  {
    name: "list_stuck_projects",
    description:
      "Proyek macet (tidak ada progres ≥ N hari, default 45). Untuk deteksi bottleneck.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        minDaysStalled: { type: SchemaType.NUMBER, description: "Default 45" },
      },
    },
  },
  {
    name: "get_blocked_tasks_summary",
    description: "Ringkasan tugas berstatus BLOCKED lintas ruangan.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { limit: { type: SchemaType.NUMBER, description: "Default 25" } },
    },
  },
  {
    name: "get_team_workload_summary",
    description:
      "Beban kerja per orang lintas tim: jumlah tugas aktif + judulnya. Untuk 'siapa paling sibuk?'.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { limit: { type: SchemaType.NUMBER, description: "Default 15" } },
    },
  },
  {
    name: "get_content_plan_status",
    description: "Status content planning (per ruangan atau semua).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        roomNameOrId: { type: SchemaType.STRING, description: "Opsional" },
      },
    },
  },
  {
    name: "list_org_users",
    description: "Daftar user organisasi + peran. Hanya CEO/Administrator.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { limit: { type: SchemaType.NUMBER, description: "Default 40" } },
    },
  },
  {
    name: "get_user_tasks",
    description:
      "Tugas milik user LAIN (by nama/email). Untuk 'apa tugas si X?'. Beda dari get_my_tasks.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        userNameOrEmailOrId: { type: SchemaType.STRING },
        status: {
          type: SchemaType.STRING,
          description: "TODO | IN_PROGRESS | OVERDUE | DONE | BLOCKED | IN_REVIEW",
        },
        limit: { type: SchemaType.NUMBER },
      },
      required: ["userNameOrEmailOrId"],
    },
  },
  {
    name: "get_users_task_overview",
    description: "Overview jumlah tugas aktif semua user sekaligus.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { limit: { type: SchemaType.NUMBER } },
    },
  },
  {
    name: "list_pending_task_approvals",
    description: "Persetujuan penyelesaian tugas yang menunggu CEO.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { limit: { type: SchemaType.NUMBER, description: "Default 20" } },
    },
  },
  {
    name: "list_pending_pipeline_approvals",
    description: "Persetujuan pindah tahap pipeline yang menunggu CEO.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { limit: { type: SchemaType.NUMBER, description: "Default 20" } },
    },
  },
  {
    name: "list_pending_finance_spend",
    description: "Pengajuan pengeluaran (spend request) yang menunggu persetujuan.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { limit: { type: SchemaType.NUMBER, description: "Default 20" } },
    },
  },
  {
    name: "get_finance_summary",
    description:
      "Ringkasan finance bulanan: pemasukan, pengeluaran, saldo bank, jurnal. Hanya CEO/Finance.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        year: { type: SchemaType.NUMBER, description: "Default tahun berjalan" },
        month: { type: SchemaType.NUMBER, description: "1-12, default bulan berjalan" },
      },
    },
  },
  {
    name: "get_ap_ar_aging",
    description:
      "Umur hutang (AP) & piutang (AR): bucket jatuh tempo. Hanya CEO/Finance.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_budget_vs_actual",
    description: "Perbandingan budget vs realisasi per akun. Hanya CEO/Finance.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        year: { type: SchemaType.NUMBER },
        month: { type: SchemaType.NUMBER, description: "1-12" },
      },
    },
  },
  {
    name: "get_schedule",
    description:
      "Agenda/jadwal event & meeting mendatang (default 7 hari ke depan).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        daysAhead: { type: SchemaType.NUMBER, description: "Default 7" },
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: "get_attendance_summary",
    description:
      "Rekap absensi satu hari: hadir, telat, belum clock-in. Hanya CEO/Administrator.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        date: { type: SchemaType.STRING, description: "YYYY-MM-DD, default hari ini" },
      },
    },
  },
  {
    name: "get_attendance_weekly_trend",
    description: "Tren kehadiran 7 hari terakhir. Hanya CEO/Administrator.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "search_room_wiki",
    description: "Cari halaman wiki ruangan berdasarkan kata kunci.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        q: { type: SchemaType.STRING, description: "Kata kunci" },
        roomNameOrId: { type: SchemaType.STRING, description: "Opsional" },
        limit: { type: SchemaType.NUMBER },
      },
      required: ["q"],
    },
  },
  {
    name: "get_wiki_page",
    description: "Isi lengkap satu halaman wiki (pageId dari search_room_wiki).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        pageId: { type: SchemaType.STRING },
      },
      required: ["pageId"],
    },
  },
  {
    name: "list_room_documents",
    description: "Daftar dokumen ruangan (per ruangan atau semua).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        roomNameOrId: { type: SchemaType.STRING, description: "Opsional" },
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: "search_room_documents",
    description: "Cari dokumen ruangan berdasarkan kata kunci judul/isi.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        q: { type: SchemaType.STRING, description: "Kata kunci" },
        roomNameOrId: { type: SchemaType.STRING, description: "Opsional" },
        limit: { type: SchemaType.NUMBER },
      },
      required: ["q"],
    },
  },
  {
    name: "get_room_document",
    description:
      "Isi/detail satu dokumen ruangan (documentId dari list/search_room_documents).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        documentId: { type: SchemaType.STRING },
      },
      required: ["documentId"],
    },
  },
];

const COMPANY_AGENT_TOOL_NAMES = new Set(
  COMPANY_AGENT_TOOL_DECLARATIONS.map((d) => d.name),
);

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Jalankan tool lintas-perusahaan; null jika `name` bukan tool grup ini. */
export async function executeAgentCompanyTool(
  user: AgentUser,
  name: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult | null> {
  if (!COMPANY_AGENT_TOOL_NAMES.has(name)) return null;

  const role = userRoleToAiRole(user.role);

  try {
    let data: unknown;

    switch (name) {
      case "get_company_executive_briefing":
        data = await aiGetCompanyExecutiveBriefing(role);
        break;
      case "get_company_risks":
        data = await aiGetCompanyRisks(role);
        break;
      case "get_recent_activity":
        data = await aiGetRecentActivity(role, {
          days: num(args.days),
          limit: num(args.limit),
        });
        break;
      case "get_sales_outgoing_by_brand":
        data = await aiGetSalesOutgoingByBrand(role, num(args.days) ?? 90);
        break;
      case "list_brands":
        data = await aiListBrands(role);
        break;
      case "get_brand_overview":
        data = await aiGetBrandOverview(role, String(args.brandNameOrId));
        break;
      case "list_products":
        data = await aiListProducts(role, num(args.limit) ?? 50);
        break;
      case "list_vendors":
        data = await aiListVendors(role, num(args.limit) ?? 30);
        break;
      case "list_projects_by_pipeline_stage":
        data = await aiListProjectsByPipelineStage(role);
        break;
      case "get_project_detail":
        data = await aiGetProjectDetail(role, String(args.projectId));
        break;
      case "list_stuck_projects":
        data = await aiListStuckProjects(role, num(args.minDaysStalled) ?? 45);
        break;
      case "get_blocked_tasks_summary":
        data = await aiGetBlockedTasksSummary(role, num(args.limit) ?? 25);
        break;
      case "get_team_workload_summary":
        data = await aiGetTeamWorkloadSummary(role, num(args.limit) ?? 15);
        break;
      case "get_content_plan_status":
        data = await aiGetContentPlanStatus(role, str(args.roomNameOrId));
        break;
      case "list_org_users":
        data = await aiListOrgUsers(role, num(args.limit) ?? 40);
        break;
      case "get_user_tasks":
        data = await aiGetUserTasks(role, {
          userNameOrEmailOrId: String(args.userNameOrEmailOrId),
          status: str(args.status)?.toUpperCase() as
            | import("@prisma/client").TaskStatus
            | undefined,
          limit: num(args.limit),
        });
        break;
      case "get_users_task_overview":
        data = await aiGetUsersTaskOverview(role, { limit: num(args.limit) });
        break;
      case "list_pending_task_approvals":
        data = await aiListPendingTaskApprovals(role, num(args.limit) ?? 20);
        break;
      case "list_pending_pipeline_approvals":
        data = await aiListPendingPipelineApprovals(role, num(args.limit) ?? 20);
        break;
      case "list_pending_finance_spend":
        data = await aiListPendingFinanceSpend(role, num(args.limit) ?? 20);
        break;
      case "get_finance_summary":
        data = await aiGetFinanceSummary(role, {
          year: num(args.year),
          month: num(args.month),
        });
        break;
      case "get_ap_ar_aging":
        data = await aiGetApArAging(role);
        break;
      case "get_budget_vs_actual":
        data = await aiGetBudgetVsActual(role, {
          year: num(args.year),
          month: num(args.month),
        });
        break;
      case "get_schedule":
        data = await aiGetSchedule(role, {
          daysAhead: num(args.daysAhead),
          limit: num(args.limit),
        });
        break;
      case "get_attendance_summary":
        data = await aiGetAttendanceSummary(role, str(args.date));
        break;
      case "get_attendance_weekly_trend":
        data = await aiGetAttendanceWeeklyTrend(role);
        break;
      case "search_room_wiki":
        data = await aiSearchWiki(role, {
          q: String(args.q),
          roomNameOrId: str(args.roomNameOrId),
          limit: num(args.limit),
        });
        break;
      case "get_wiki_page":
        data = await aiGetWikiPage(role, String(args.pageId));
        break;
      case "list_room_documents":
        data = await aiListRoomDocuments(role, {
          roomNameOrId: str(args.roomNameOrId),
          limit: num(args.limit),
        });
        break;
      case "search_room_documents":
        data = await aiSearchDocuments(role, {
          q: String(args.q),
          roomNameOrId: str(args.roomNameOrId),
          limit: num(args.limit),
        });
        break;
      case "get_room_document":
        data = await aiGetRoomDocumentContent(role, String(args.documentId));
        break;
      default:
        return { ok: false, error: `Tool tidak dikenal: ${name}` };
    }

    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan.",
    };
  }
}
