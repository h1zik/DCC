import { TaskPriority, TaskStatus } from "@prisma/client";
import type { Tool } from "@google/generative-ai";
import { SchemaType } from "@google/generative-ai";
import {
  analyzeRoomWorkload,
  getAgentInventoryAlerts,
  getAgentTaskComments,
  getAgentTaskCommentsInRoom,
  getUpcomingDeadlines,
  listMyAgentTasks,
  summarizeUserWorkspaces,
} from "./analytics";
import {
  getAgentKanbanBoard,
  getAgentKanbanBoardByRoomName,
  getAgentKpi,
  getAgentOverdueTasks,
  getAgentTaskDetail,
  listAgentRoomMembers,
  getAgentUserAccessSummary,
  listAgentRoomProcessPhases,
  listAgentRoomProjects,
  listAgentRooms,
  listAgentTasks,
  resolveAgentRoom,
} from "./queries";
import {
  agentAddChecklistInRoom,
  agentAddChecklistItem,
  agentAddTaskComment,
  agentAddTaskCommentInRoom,
  agentArchiveCompletedTasksInRoom,
  agentArchiveTaskInRoom,
  agentCreateTask,
  agentCreateTaskInRoom,
  agentDeleteTaskInRoom,
  agentDeleteTasksInRoom,
  agentEditTaskInRoom,
  agentMoveTaskInRoom,
  agentMoveTasksInRoom,
  agentMoveTaskStatus,
  agentToggleChecklistInRoom,
  agentUpdateTask,
} from "./mutations";
import { isBulkTaskTitleSearch } from "./task-disambiguation";
import { fetchWebsiteContent } from "./website-fetch";
import {
  RESEARCH_AGENT_TOOL_DECLARATIONS,
  executeAgentResearchTool,
} from "./research-tools";
import type { AgentToolResult, AgentUser } from "./types";

export const AGENT_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "list_rooms",
        description:
          "Daftar ruangan kerja yang dapat diakses user. Gunakan untuk menemukan roomId sebelum operasi kanban.",
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: "get_kanban_board",
        description:
          "Papan Kanban lengkap: kolom status + tugas. Pakai roomNameOrId (nama ruangan) — lebih mudah daripada ID.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: {
              type: SchemaType.STRING,
              description: 'Nama ruangan, mis. "Room Archipelago"',
            },
            roomId: {
              type: SchemaType.STRING,
              description: "ID ruangan (opsional jika roomNameOrId sudah ada)",
            },
            processPhaseNameOrId: {
              type: SchemaType.STRING,
              description: "Fase proses, mis. Brand & Design (opsional)",
            },
            customProcessPhaseId: {
              type: SchemaType.STRING,
              description: "ID fase (opsional)",
            },
          },
        },
      },
      {
        name: "get_my_tasks",
        description:
          "Tugas yang ditugaskan ke user yang sedang chat. Berguna untuk 'apa tugas saya?' atau prioritas harian.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            status: {
              type: SchemaType.STRING,
              description: "Filter status (opsional)",
            },
            limit: { type: SchemaType.NUMBER },
          },
        },
      },
      {
        name: "analyze_room_workload",
        description:
          "Analisis workload ruangan: distribusi status, overdue, deadline minggu ini, insight. Untuk pertanyaan 'gimana kondisi ruangan X?'.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
          },
          required: ["roomNameOrId"],
        },
      },
      {
        name: "summarize_workspaces",
        description:
          "Ringkasan semua ruangan user: total tugas, overdue, tugas saya per ruangan. Untuk overview harian.",
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: "get_upcoming_deadlines",
        description:
          "Tugas dengan deadline mendatang (default 14 hari). Bisa filter per ruangan.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            daysAhead: { type: SchemaType.NUMBER, description: "Default 14" },
            roomNameOrId: { type: SchemaType.STRING },
            limit: { type: SchemaType.NUMBER },
          },
        },
      },
      {
        name: "get_task_comments",
        description: "Baca komentar diskusi pada tugas (by taskId).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            taskId: { type: SchemaType.STRING },
            limit: { type: SchemaType.NUMBER },
          },
          required: ["taskId"],
        },
      },
      {
        name: "get_task_comments_in_room",
        description:
          "Baca komentar tugas berdasarkan nama ruangan + kata kunci judul.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
            taskTitleSearch: { type: SchemaType.STRING },
            processPhaseNameOrId: { type: SchemaType.STRING },
            limit: { type: SchemaType.NUMBER },
          },
          required: ["roomNameOrId", "taskTitleSearch"],
        },
      },
      {
        name: "get_inventory_alerts",
        description:
          "Alert stok inventori kritis/rendah. Hanya untuk peran yang punya akses logistik.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            severity: {
              type: SchemaType.STRING,
              description: "all | critical | low",
            },
            limit: { type: SchemaType.NUMBER },
          },
        },
      },
      {
        name: "list_tasks",
        description:
          "Cari daftar tugas (sudah difilter sesuai akses fase user). Tampilkan phaseName untuk bedakan tugas duplikat.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: {
              type: SchemaType.STRING,
              description: "Filter per nama ruangan",
            },
            roomId: { type: SchemaType.STRING, description: "Filter per roomId" },
            status: {
              type: SchemaType.STRING,
              description:
                "TODO | IN_PROGRESS | OVERDUE | DONE | BLOCKED | IN_REVIEW",
            },
            search: {
              type: SchemaType.STRING,
              description: "Kata kunci di judul tugas",
            },
            processPhaseNameOrId: {
              type: SchemaType.STRING,
              description: "Filter fase proses, mis. Brand & Design",
            },
            limit: { type: SchemaType.NUMBER, description: "Maks baris (default 30)" },
          },
        },
      },
      {
        name: "get_my_access",
        description:
          "Hak akses user: peran global, peran per ruangan (Kontributor/Manager), fase yang bisa diakses.",
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: "get_task_detail",
        description: "Detail lengkap satu tugas termasuk checklist dan tag.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            taskId: { type: SchemaType.STRING },
          },
          required: ["taskId"],
        },
      },
      {
        name: "list_room_process_phases",
        description:
          "Daftar fase proses di ruangan. Ruangan brand punya fase (Market Research, Brand & Design, dll). Ruangan HQ/Team tanpa brand hanya punya satu papan Tasks — jangan sebut fase brand untuk ruangan itu.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: {
              type: SchemaType.STRING,
              description: "Nama atau ID ruangan",
            },
          },
          required: ["roomNameOrId"],
        },
      },
      {
        name: "list_room_projects",
        description:
          "Daftar proyek di ruangan. Diperlukan projectId saat membuat tugas baru.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomId: { type: SchemaType.STRING },
          },
          required: ["roomId"],
        },
      },
      {
        name: "list_room_members",
        description: "Daftar anggota ruangan untuk assignee tugas.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomId: { type: SchemaType.STRING },
          },
          required: ["roomId"],
        },
      },
      {
        name: "create_task_in_room",
        description:
          "UTAMA untuk buat tugas. Butuh nama ruangan + judul. Jika user punya akses >1 fase di ruangan itu, WAJIB isi processPhaseNameOrId atau tanya user dulu — tool akan menolak jika fase tidak jelas.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: {
              type: SchemaType.STRING,
              description: 'Nama ruangan, mis. "List KOL (HQ)"',
            },
            title: { type: SchemaType.STRING, description: "Judul tugas" },
            description: { type: SchemaType.STRING },
            priority: {
              type: SchemaType.STRING,
              description: "LOW | MEDIUM | HIGH | URGENT",
            },
            status: {
              type: SchemaType.STRING,
              description: "Status awal, default TODO",
            },
            dueDate: {
              type: SchemaType.STRING,
              description: 'ISO date atau kata relatif: "besok", "hari ini", "lusa"',
            },
            assignCurrentUserAsPic: {
              type: SchemaType.BOOLEAN,
              description:
                "true jika user minta PIC saya/aku/saya sendiri — pakai identitas user yang sedang chat",
            },
            assigneeNames: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Nama PIC lain (bukan ID). Jangan pakai untuk 'saya'.",
            },
            processPhaseNameOrId: {
              type: SchemaType.STRING,
              description:
                'Wajib jika user punya akses ke lebih dari 1 fase di ruangan ini. Mis. "brand design" atau "Brand & Design".',
            },
            customProcessPhaseId: {
              type: SchemaType.STRING,
              description: "ID fase (opsional, hanya jika sudah diketahui)",
            },
          },
          required: ["roomNameOrId", "title"],
        },
      },
      {
        name: "create_task",
        description:
          "Buat tugas dengan projectId eksplisit. Hanya jika create_task_in_room tidak cukup.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            projectId: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING },
            priority: {
              type: SchemaType.STRING,
              description: "LOW | MEDIUM | HIGH | URGENT",
            },
            status: {
              type: SchemaType.STRING,
              description: "Status awal, default TODO",
            },
            dueDate: {
              type: SchemaType.STRING,
              description: "ISO date string, mis. 2026-06-10",
            },
            assigneeIds: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "User ID dari list_room_members",
            },
            customProcessPhaseId: { type: SchemaType.STRING },
          },
          required: ["projectId", "title"],
        },
      },
      {
        name: "edit_task_in_room",
        description:
          "Edit tugas: judul, deskripsi, prioritas, deadline, status, PIC. Hanya isi field yang ingin diubah. Jika judul duplikat, pakai processPhaseNameOrId.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
            taskTitleSearch: {
              type: SchemaType.STRING,
              description: "Kata kunci judul tugas yang akan diedit",
            },
            processPhaseNameOrId: {
              type: SchemaType.STRING,
              description: "Fase proses untuk bedakan tugas duplikat",
            },
            title: { type: SchemaType.STRING, description: "Judul baru" },
            description: { type: SchemaType.STRING, description: "Deskripsi baru" },
            priority: {
              type: SchemaType.STRING,
              description: "LOW | MEDIUM | HIGH | URGENT",
            },
            status: {
              type: SchemaType.STRING,
              description:
                "TODO | IN_PROGRESS | OVERDUE | DONE | BLOCKED | IN_REVIEW",
            },
            dueDate: {
              type: SchemaType.STRING,
              description: 'Deadline baru: ISO date atau "besok", "hari ini"',
            },
            assignCurrentUserAsPic: {
              type: SchemaType.BOOLEAN,
              description: "true untuk set PIC = user yang sedang chat",
            },
            assigneeNames: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Nama PIC baru (hanya Manager/PM)",
            },
          },
          required: ["roomNameOrId", "taskTitleSearch"],
        },
      },
      {
        name: "move_task_in_room",
        description:
          "Pindah status SATU tugas by judul. Untuk beberapa tugas sekaligus gunakan move_tasks_in_room.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
            taskTitleSearch: {
              type: SchemaType.STRING,
              description: "Kata kunci judul tugas",
            },
            processPhaseNameOrId: {
              type: SchemaType.STRING,
              description:
                'Fase proses untuk bedakan tugas duplikat, mis. "brand design"',
            },
            status: {
              type: SchemaType.STRING,
              description:
                "TODO | IN_PROGRESS | OVERDUE | DONE | BLOCKED | IN_REVIEW",
            },
          },
          required: ["roomNameOrId", "taskTitleSearch", "status"],
        },
      },
      {
        name: "move_tasks_in_room",
        description:
          "Pindah status BEBERAPA tugas sekaligus. Untuk 'semua tugas TODO ke Berjalan', atau beberapa judul via taskTitleSearches. Tidak perlu konfirmasi.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
            status: {
              type: SchemaType.STRING,
              description: "Status tujuan",
            },
            taskTitleSearches: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description:
                'Daftar kata kunci judul, mis. ["review", "packaging"]. Kosongkan + fromStatus untuk semua tugas dengan status tertentu.',
            },
            taskTitleSearch: {
              type: SchemaType.STRING,
              description: 'Satu judul atau "semua"',
            },
            fromStatus: {
              type: SchemaType.STRING,
              description:
                "Filter status saat ini, mis. TODO untuk 'pindah semua TODO ke IN_PROGRESS'",
            },
            processPhaseNameOrId: {
              type: SchemaType.STRING,
              description: "Filter fase proses (opsional)",
            },
          },
          required: ["roomNameOrId", "status"],
        },
      },
      {
        name: "delete_task_in_room",
        description:
          "Hapus SATU tugas permanen. WAJIB 2 langkah: (1) panggil confirmed:false untuk preview, (2) setelah user konfirmasi ya/konfirmasi, panggil confirmed:true. Hanya Manager.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
            taskTitleSearch: { type: SchemaType.STRING },
            processPhaseNameOrId: { type: SchemaType.STRING },
            confirmed: {
              type: SchemaType.BOOLEAN,
              description:
                "false = preview & minta konfirmasi user. true = hapus setelah user setuju.",
            },
          },
          required: ["roomNameOrId", "taskTitleSearch", "confirmed"],
        },
      },
      {
        name: "delete_tasks_in_room",
        description:
          "Hapus BEBERAPA tugas permanen sekaligus. WAJIB konfirmasi 2 langkah seperti delete_task_in_room. Gunakan taskTitleSearches, fromStatus, atau fase untuk filter bulk.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
            confirmed: {
              type: SchemaType.BOOLEAN,
              description: "false = preview. true = hapus setelah user konfirmasi.",
            },
            taskTitleSearches: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Beberapa kata kunci judul",
            },
            taskTitleSearch: {
              type: SchemaType.STRING,
              description: '"semua" atau satu judul',
            },
            fromStatus: {
              type: SchemaType.STRING,
              description: "Filter status saat ini",
            },
            processPhaseNameOrId: { type: SchemaType.STRING },
          },
          required: ["roomNameOrId", "confirmed"],
        },
      },
      {
        name: "move_task_status",
        description:
          "Pindahkan tugas by taskId. Gunakan move_task_in_room jika user menyebut nama ruangan/judul.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            taskId: { type: SchemaType.STRING },
            status: {
              type: SchemaType.STRING,
              description:
                "TODO | IN_PROGRESS | OVERDUE | DONE | BLOCKED | IN_REVIEW",
            },
          },
          required: ["taskId", "status"],
        },
      },
      {
        name: "add_checklist_item",
        description: "Tambahkan item checklist ke tugas (by taskId).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            taskId: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
          },
          required: ["taskId", "title"],
        },
      },
      {
        name: "add_checklist_in_room",
        description:
          "Tambah checklist berdasarkan nama ruangan + kata kunci judul tugas.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
            taskTitleSearch: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
            processPhaseNameOrId: { type: SchemaType.STRING },
          },
          required: ["roomNameOrId", "taskTitleSearch", "title"],
        },
      },
      {
        name: "toggle_checklist_in_room",
        description:
          "Centang/buka checklist item berdasarkan nama ruangan + judul tugas + kata kunci item checklist.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
            taskTitleSearch: { type: SchemaType.STRING },
            checklistTitleSearch: { type: SchemaType.STRING },
            done: {
              type: SchemaType.BOOLEAN,
              description: "true = centang selesai, false = buka kembali",
            },
            processPhaseNameOrId: { type: SchemaType.STRING },
          },
          required: [
            "roomNameOrId",
            "taskTitleSearch",
            "checklistTitleSearch",
            "done",
          ],
        },
      },
      {
        name: "add_task_comment",
        description: "Tambah komentar pada tugas (by taskId).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            taskId: { type: SchemaType.STRING },
            body: { type: SchemaType.STRING },
          },
          required: ["taskId", "body"],
        },
      },
      {
        name: "add_task_comment_in_room",
        description:
          "Tambah komentar berdasarkan nama ruangan + kata kunci judul tugas.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
            taskTitleSearch: { type: SchemaType.STRING },
            body: { type: SchemaType.STRING },
            processPhaseNameOrId: { type: SchemaType.STRING },
          },
          required: ["roomNameOrId", "taskTitleSearch", "body"],
        },
      },
      {
        name: "archive_task_in_room",
        description:
          "Arsipkan SATU tugas selesai by judul. Jangan pakai untuk 'semua' — gunakan archive_completed_tasks_in_room.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
            taskTitleSearch: { type: SchemaType.STRING },
            processPhaseNameOrId: { type: SchemaType.STRING },
          },
          required: ["roomNameOrId", "taskTitleSearch"],
        },
      },
      {
        name: "archive_completed_tasks_in_room",
        description:
          "Arsipkan SEMUA tugas berstatus DONE/selesai di ruangan. Untuk 'arsip semua tugas selesai di ruang X fase Y'. Tidak perlu judul tugas.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            roomNameOrId: { type: SchemaType.STRING },
            processPhaseNameOrId: {
              type: SchemaType.STRING,
              description: 'Filter fase, mis. "brand & design"',
            },
          },
          required: ["roomNameOrId"],
        },
      },
      {
        name: "get_kpi_overview",
        description:
          "Ringkasan KPI: tugas overdue, stok kritis, persetujuan pending.",
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: "get_overdue_tasks",
        description: "Daftar tugas yang sudah melewati tenggat.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            limit: { type: SchemaType.NUMBER, description: "Maks baris (default 20)" },
          },
        },
      },
      {
        name: "fetch_website",
        description:
          "Baca konten halaman web publik (http/https) untuk dianalisis atau dirangkum.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            url: { type: SchemaType.STRING, description: "URL lengkap halaman" },
          },
          required: ["url"],
        },
      },
      ...RESEARCH_AGENT_TOOL_DECLARATIONS,
    ],
  },
];

function parseTaskStatus(raw: unknown): TaskStatus {
  const s = String(raw ?? "").toUpperCase();
  if (!(s in TaskStatus)) {
    throw new Error(
      `Status tidak valid: ${raw}. Gunakan TODO, IN_PROGRESS, OVERDUE, DONE, BLOCKED, atau IN_REVIEW.`,
    );
  }
  return s as TaskStatus;
}

function parseTaskPriority(raw: unknown): TaskPriority | undefined {
  if (raw == null) return undefined;
  const p = String(raw).toUpperCase();
  if (!(p in TaskPriority)) {
    throw new Error(`Prioritas tidak valid: ${raw}`);
  }
  return p as TaskPriority;
}

export async function executeAgentTool(
  user: AgentUser,
  name: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult> {
  try {
    const researchResult = await executeAgentResearchTool(user, name, args);
    if (researchResult) return researchResult;

    let data: unknown;

    switch (name) {
      case "list_rooms":
        data = await listAgentRooms(user);
        break;
      case "get_kanban_board": {
        const roomKey = args.roomNameOrId ?? args.roomId;
        if (!roomKey) {
          throw new Error("Butuh roomNameOrId atau roomId.");
        }
        if (args.roomNameOrId || !args.customProcessPhaseId) {
          data = await getAgentKanbanBoardByRoomName(
            user,
            String(roomKey),
            args.processPhaseNameOrId
              ? String(args.processPhaseNameOrId)
              : null,
          );
        } else {
          data = await getAgentKanbanBoard(
            user,
            String(roomKey),
            args.customProcessPhaseId
              ? String(args.customProcessPhaseId)
              : null,
          );
        }
        break;
      }
      case "get_my_tasks":
        data = await listMyAgentTasks(user, {
          status: args.status ? parseTaskStatus(args.status) : undefined,
          limit: typeof args.limit === "number" ? args.limit : undefined,
        });
        break;
      case "analyze_room_workload":
        data = await analyzeRoomWorkload(user, String(args.roomNameOrId));
        break;
      case "summarize_workspaces":
        data = await summarizeUserWorkspaces(user);
        break;
      case "get_upcoming_deadlines":
        data = await getUpcomingDeadlines(user, {
          daysAhead:
            typeof args.daysAhead === "number" ? args.daysAhead : undefined,
          roomNameOrId: args.roomNameOrId
            ? String(args.roomNameOrId)
            : undefined,
          limit: typeof args.limit === "number" ? args.limit : undefined,
        });
        break;
      case "get_task_comments":
        data = await getAgentTaskComments(
          user,
          String(args.taskId),
          typeof args.limit === "number" ? args.limit : 15,
        );
        break;
      case "get_task_comments_in_room":
        data = await getAgentTaskCommentsInRoom(user, {
          roomNameOrId: String(args.roomNameOrId),
          taskTitleSearch: String(args.taskTitleSearch),
          processPhaseNameOrId: args.processPhaseNameOrId
            ? String(args.processPhaseNameOrId)
            : null,
          limit: typeof args.limit === "number" ? args.limit : undefined,
        });
        break;
      case "get_inventory_alerts":
        data = await getAgentInventoryAlerts(user, {
          severity: args.severity
            ? (String(args.severity) as "all" | "critical" | "low")
            : undefined,
          limit: typeof args.limit === "number" ? args.limit : undefined,
        });
        break;
      case "list_tasks": {
        let roomId = args.roomId ? String(args.roomId) : undefined;
        if (args.roomNameOrId) {
          const room = await resolveAgentRoom(user, String(args.roomNameOrId));
          roomId = room.id;
        }
        data = await listAgentTasks(user, {
          roomId,
          status: args.status ? parseTaskStatus(args.status) : undefined,
          search: args.search ? String(args.search) : undefined,
          processPhaseNameOrId: args.processPhaseNameOrId
            ? String(args.processPhaseNameOrId)
            : undefined,
          limit: typeof args.limit === "number" ? args.limit : undefined,
        });
        break;
      }
      case "get_my_access":
        data = await getAgentUserAccessSummary(user);
        break;
      case "get_task_detail":
        data = await getAgentTaskDetail(user, String(args.taskId));
        break;
      case "list_room_process_phases": {
        const room = await resolveAgentRoom(user, String(args.roomNameOrId));
        data = await listAgentRoomProcessPhases(user, room.id);
        break;
      }
      case "list_room_projects":
        data = await listAgentRoomProjects(user, String(args.roomId));
        break;
      case "list_room_members":
        data = await listAgentRoomMembers(user, String(args.roomId));
        break;
      case "create_task_in_room":
        data = await agentCreateTaskInRoom(user, {
          roomNameOrId: String(args.roomNameOrId),
          title: String(args.title),
          description: args.description ? String(args.description) : null,
          priority: parseTaskPriority(args.priority),
          status: args.status ? parseTaskStatus(args.status) : undefined,
          dueDate: args.dueDate ? String(args.dueDate) : null,
          assignCurrentUserAsPic: args.assignCurrentUserAsPic === true,
          assigneeNames: Array.isArray(args.assigneeNames)
            ? args.assigneeNames.map(String)
            : undefined,
          processPhaseNameOrId: args.processPhaseNameOrId
            ? String(args.processPhaseNameOrId)
            : null,
          customProcessPhaseId: args.customProcessPhaseId
            ? String(args.customProcessPhaseId)
            : null,
        });
        break;
      case "create_task":
        data = await agentCreateTask(user, {
          projectId: String(args.projectId),
          title: String(args.title),
          description: args.description ? String(args.description) : null,
          priority: parseTaskPriority(args.priority),
          status: args.status ? parseTaskStatus(args.status) : undefined,
          dueDate: args.dueDate ? String(args.dueDate) : null,
          assigneeIds: Array.isArray(args.assigneeIds)
            ? args.assigneeIds.map(String)
            : undefined,
          customProcessPhaseId: args.customProcessPhaseId
            ? String(args.customProcessPhaseId)
            : null,
        });
        break;
      case "edit_task_in_room":
        data = await agentEditTaskInRoom(user, {
          roomNameOrId: String(args.roomNameOrId),
          taskTitleSearch: String(args.taskTitleSearch),
          processPhaseNameOrId: args.processPhaseNameOrId
            ? String(args.processPhaseNameOrId)
            : null,
          title: args.title ? String(args.title) : undefined,
          description:
            args.description !== undefined
              ? String(args.description)
              : undefined,
          priority: parseTaskPriority(args.priority),
          status: args.status ? parseTaskStatus(args.status) : undefined,
          dueDate: args.dueDate !== undefined ? String(args.dueDate) : undefined,
          assignCurrentUserAsPic: args.assignCurrentUserAsPic === true,
          assigneeNames: Array.isArray(args.assigneeNames)
            ? args.assigneeNames.map(String)
            : undefined,
        });
        break;
      case "move_task_in_room": {
        const titleSearch = String(args.taskTitleSearch ?? "").trim();
        if (isBulkTaskTitleSearch(titleSearch)) {
          data = await agentMoveTasksInRoom(user, {
            roomNameOrId: String(args.roomNameOrId),
            taskTitleSearch: titleSearch,
            processPhaseNameOrId: args.processPhaseNameOrId
              ? String(args.processPhaseNameOrId)
              : null,
            status: parseTaskStatus(args.status),
          });
        } else {
          data = await agentMoveTaskInRoom(user, {
            roomNameOrId: String(args.roomNameOrId),
            taskTitleSearch: titleSearch,
            processPhaseNameOrId: args.processPhaseNameOrId
              ? String(args.processPhaseNameOrId)
              : null,
            status: parseTaskStatus(args.status),
          });
        }
        break;
      }
      case "move_tasks_in_room":
        data = await agentMoveTasksInRoom(user, {
          roomNameOrId: String(args.roomNameOrId),
          status: parseTaskStatus(args.status),
          taskTitleSearches: Array.isArray(args.taskTitleSearches)
            ? args.taskTitleSearches.map(String)
            : undefined,
          taskTitleSearch: args.taskTitleSearch
            ? String(args.taskTitleSearch)
            : null,
          fromStatus: args.fromStatus
            ? parseTaskStatus(args.fromStatus)
            : null,
          processPhaseNameOrId: args.processPhaseNameOrId
            ? String(args.processPhaseNameOrId)
            : null,
        });
        break;
      case "delete_task_in_room":
        data = await agentDeleteTaskInRoom(user, {
          roomNameOrId: String(args.roomNameOrId),
          taskTitleSearch: String(args.taskTitleSearch),
          processPhaseNameOrId: args.processPhaseNameOrId
            ? String(args.processPhaseNameOrId)
            : null,
          confirmed: args.confirmed === true,
        });
        break;
      case "delete_tasks_in_room":
        data = await agentDeleteTasksInRoom(user, {
          roomNameOrId: String(args.roomNameOrId),
          confirmed: args.confirmed === true,
          taskTitleSearches: Array.isArray(args.taskTitleSearches)
            ? args.taskTitleSearches.map(String)
            : undefined,
          taskTitleSearch: args.taskTitleSearch
            ? String(args.taskTitleSearch)
            : null,
          fromStatus: args.fromStatus
            ? parseTaskStatus(args.fromStatus)
            : null,
          processPhaseNameOrId: args.processPhaseNameOrId
            ? String(args.processPhaseNameOrId)
            : null,
        });
        break;
      case "move_task_status":
        data = await agentMoveTaskStatus(user, {
          taskId: String(args.taskId),
          status: parseTaskStatus(args.status),
        });
        break;
      case "add_checklist_item":
        data = await agentAddChecklistItem(user, {
          taskId: String(args.taskId),
          title: String(args.title),
        });
        break;
      case "add_checklist_in_room":
        data = await agentAddChecklistInRoom(user, {
          roomNameOrId: String(args.roomNameOrId),
          taskTitleSearch: String(args.taskTitleSearch),
          title: String(args.title),
          processPhaseNameOrId: args.processPhaseNameOrId
            ? String(args.processPhaseNameOrId)
            : null,
        });
        break;
      case "toggle_checklist_in_room":
        data = await agentToggleChecklistInRoom(user, {
          roomNameOrId: String(args.roomNameOrId),
          taskTitleSearch: String(args.taskTitleSearch),
          checklistTitleSearch: String(args.checklistTitleSearch),
          done: args.done === true,
          processPhaseNameOrId: args.processPhaseNameOrId
            ? String(args.processPhaseNameOrId)
            : null,
        });
        break;
      case "add_task_comment":
        data = await agentAddTaskComment(user, {
          taskId: String(args.taskId),
          body: String(args.body),
        });
        break;
      case "add_task_comment_in_room":
        data = await agentAddTaskCommentInRoom(user, {
          roomNameOrId: String(args.roomNameOrId),
          taskTitleSearch: String(args.taskTitleSearch),
          body: String(args.body),
          processPhaseNameOrId: args.processPhaseNameOrId
            ? String(args.processPhaseNameOrId)
            : null,
        });
        break;
      case "archive_task_in_room": {
        const titleSearch = String(args.taskTitleSearch ?? "").trim();
        const isBulk =
          /^(semua|all|semua tugas|tugas selesai|yang selesai|completed)$/i.test(
            titleSearch,
          );
        if (isBulk) {
          data = await agentArchiveCompletedTasksInRoom(user, {
            roomNameOrId: String(args.roomNameOrId),
            processPhaseNameOrId: args.processPhaseNameOrId
              ? String(args.processPhaseNameOrId)
              : null,
          });
        } else {
          data = await agentArchiveTaskInRoom(user, {
            roomNameOrId: String(args.roomNameOrId),
            taskTitleSearch: titleSearch,
            processPhaseNameOrId: args.processPhaseNameOrId
              ? String(args.processPhaseNameOrId)
              : null,
          });
        }
        break;
      }
      case "archive_completed_tasks_in_room":
        data = await agentArchiveCompletedTasksInRoom(user, {
          roomNameOrId: String(args.roomNameOrId),
          processPhaseNameOrId: args.processPhaseNameOrId
            ? String(args.processPhaseNameOrId)
            : null,
        });
        break;
      case "get_kpi_overview":
        data = await getAgentKpi(user);
        break;
      case "get_overdue_tasks":
        data = await getAgentOverdueTasks(
          user,
          typeof args.limit === "number" ? args.limit : 20,
        );
        break;
      case "fetch_website":
        data = await fetchWebsiteContent(String(args.url));
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
