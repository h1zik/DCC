/**

 * MCP server read-only untuk Odysseus -> DCC Railway.

 *

 * Setup VPS:

 *   1. cd mcp-server && npm install && npm run build

 *   2. Set env:

 *        DCC_AI_API_URL=https://<domain-railway-anda>

 *        DCC_AI_READ_API_TOKEN=<sama dengan AI_READ_API_TOKEN di Railway>

 *        DCC_AI_ROLE=CEO

 *   3. Di Odysseus Settings -> MCP Servers, tambahkan:

 *        command: node

 *        args: ["/path/ke/DCC/mcp-server/dist/index.js"]

 *        env: { DCC_AI_API_URL, DCC_AI_READ_API_TOKEN, DCC_AI_ROLE }

 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const DCC_AI_API_URL = (process.env.DCC_AI_API_URL ?? "").replace(/\/$/, "");
const DCC_AI_READ_API_TOKEN = process.env.DCC_AI_READ_API_TOKEN ?? "";
const DCC_AI_ROLE = (process.env.DCC_AI_ROLE ?? "CEO").toUpperCase();
function requireConfig() {
    if (!DCC_AI_API_URL) {
        throw new Error("DCC_AI_API_URL belum diset.");
    }
    if (!DCC_AI_READ_API_TOKEN) {
        throw new Error("DCC_AI_READ_API_TOKEN belum diset.");
    }
}
async function dccFetch(path) {
    const res = await fetch(`${DCC_AI_API_URL}${path}`, {
        headers: {
            Authorization: `Bearer ${DCC_AI_READ_API_TOKEN}`,
            "x-dcc-role": DCC_AI_ROLE,
            Accept: "application/json",
        },
    });
    const body = (await res.json().catch(() => ({})));
    if (!res.ok) {
        const err = typeof body.error === "string" ? body.error : `HTTP ${res.status}`;
        throw new Error(`DCC API error: ${err}`);
    }
    return body;
}
function buildQuery(params) {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === "")
            continue;
        q.set(key, String(value));
    }
    const s = q.toString();
    return s ? `?${s}` : "";
}
function asText(data) {
    return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
}
const limitSchema = z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Jumlah maksimal baris");
const roomNameSchema = z
    .string()
    .min(1)
    .describe('Nama atau ID ruangan, mis. "Room Archipelago"');
async function main() {
    requireConfig();
    const server = new McpServer({
        name: "dcc-read-api",
        version: "3.2.0",
    });
    server.tool("get_kpi_overview", "Ringkasan KPI operasional Dominatus Control Center: tugas overdue, stok kritis, persetujuan pending.", {}, async () => asText(await dccFetch("/api/ai/kpi-overview")));
    server.tool("get_overdue_tasks", "Daftar tugas yang sudah melewati tenggat (overdue) beserta assignee dan konteks proyek/ruangan.", {
        limit: limitSchema.describe("Default 20, maks 50"),
    }, async ({ limit }) => asText(await dccFetch(`/api/ai/tasks/overdue${buildQuery({ limit })}`)));
    server.tool("get_inventory_alerts", "SKU dengan stok rendah atau kritis yang perlu perhatian logistik.", {
        severity: z
            .enum(["all", "critical", "low"])
            .optional()
            .describe("Filter: all (default), critical, low"),
        limit: limitSchema.describe("Default 30, maks 50"),
    }, async ({ severity, limit }) => asText(await dccFetch(`/api/ai/inventory/alerts${buildQuery({ severity, limit })}`)));
    server.tool("dcc_health_check", "Cek koneksi token ke DCC Railway tanpa mengekspos data bisnis.", {}, async () => asText(await dccFetch("/api/ai/health")));
    server.tool("list_rooms", "Daftar ruangan kerja DCC yang dapat diakses (nama, brand, section).", {}, async () => asText(await dccFetch("/api/ai/rooms")));
    server.tool("summarize_workspaces", "Ringkasan workload semua ruangan: overdue, in progress, tugas aktif per ruang.", {}, async () => asText(await dccFetch("/api/ai/workspaces/summary")));
    server.tool("analyze_room_workload", "Analisis mendalam satu ruangan: distribusi status, overdue, deadline minggu ini, insight.", { roomNameOrId: roomNameSchema }, async ({ roomNameOrId }) => asText(await dccFetch(`/api/ai/rooms/workload${buildQuery({ roomNameOrId })}`)));
    server.tool("get_kanban_board", "Papan Kanban ruangan: kolom status + daftar tugas (maks 15 per kolom).", {
        roomNameOrId: roomNameSchema,
        processPhaseNameOrId: z
            .string()
            .optional()
            .describe('Fase proses brand, mis. "Brand & Design". Ruangan HQ/Team tanpa brand: abaikan.'),
    }, async ({ roomNameOrId, processPhaseNameOrId }) => asText(await dccFetch(`/api/ai/kanban${buildQuery({ roomNameOrId, processPhaseNameOrId })}`)));
    server.tool("get_user_tasks", "Tugas milik satu user (PIC): jumlah per status + daftar judul tugas. Wajib isi userNameOrEmailOrId (nama, email, atau ID).", {
        userNameOrEmailOrId: z
            .string()
            .min(1)
            .describe("Nama, email, atau user ID — contoh: Budi, budi@perusahaan.com"),
        status: z
            .enum([
            "TODO",
            "IN_PROGRESS",
            "OVERDUE",
            "DONE",
            "BLOCKED",
            "IN_REVIEW",
        ])
            .optional()
            .describe("Filter satu status saja (opsional)"),
        includeDone: z
            .boolean()
            .optional()
            .describe("Sertakan tugas DONE (default false, hanya tugas aktif)"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe("Default 50, maks 100"),
    }, async ({ userNameOrEmailOrId, status, includeDone, limit }) => asText(await dccFetch(`/api/ai/users/tasks${buildQuery({ userNameOrEmailOrId, status, includeDone, limit })}`)));
    server.tool("get_users_task_overview", "Ringkasan semua user: berapa tugas aktif masing-masing (+ sample judul tugas jika diminta). Ideal untuk 'siapa paling sibuk?' atau 'PIC siapa saja?'.", {
        includeTaskTitles: z
            .boolean()
            .optional()
            .describe("Sertakan sample judul tugas per user (default false)"),
        tasksPerUser: z
            .number()
            .int()
            .min(1)
            .max(20)
            .optional()
            .describe("Jumlah judul tugas per user jika includeTaskTitles=true (default 8)"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(80)
            .optional()
            .describe("Maks user yang dikembalikan (default 50)"),
        activeOnly: z
            .boolean()
            .optional()
            .describe("Hanya tugas non-DONE (default true)"),
    }, async ({ includeTaskTitles, tasksPerUser, limit, activeOnly }) => asText(await dccFetch(`/api/ai/users/task-overview${buildQuery({ includeTaskTitles, tasksPerUser, limit, activeOnly })}`)));
    server.tool("list_tasks", "Cari tugas dengan filter ruangan, status, judul, atau PIC (assigneeNameOrEmailOrId). Untuk 'tugas user X' lebih mudah pakai get_user_tasks.", {
        roomNameOrId: z.string().optional().describe("Filter ruangan (opsional)"),
        assigneeNameOrEmailOrId: z
            .string()
            .optional()
            .describe("Filter PIC — nama, email, atau user ID"),
        status: z
            .enum([
            "TODO",
            "IN_PROGRESS",
            "OVERDUE",
            "DONE",
            "BLOCKED",
            "IN_REVIEW",
        ])
            .optional(),
        search: z.string().optional().describe("Cari di judul tugas"),
        limit: limitSchema.describe("Default 30, maks 50"),
    }, async ({ roomNameOrId, assigneeNameOrEmailOrId, status, search, limit }) => asText(await dccFetch(`/api/ai/tasks${buildQuery({ roomNameOrId, assigneeNameOrEmailOrId, status, search, limit })}`)));
    server.tool("get_upcoming_deadlines", "Tugas dengan deadline mendatang (default 14 hari ke depan).", {
        daysAhead: z
            .number()
            .int()
            .min(1)
            .max(30)
            .optional()
            .describe("Hari ke depan (default 14)"),
        roomNameOrId: z.string().optional(),
        limit: limitSchema.describe("Default 25, maks 50"),
    }, async ({ daysAhead, roomNameOrId, limit }) => asText(await dccFetch(`/api/ai/tasks/deadlines${buildQuery({ daysAhead, roomNameOrId, limit })}`)));
    server.tool("get_task_detail", "Detail lengkap satu tugas: deskripsi, checklist, tags, PIC, fase.", {
        taskId: z.string().min(1).describe("ID tugas DCC"),
    }, async ({ taskId }) => asText(await dccFetch(`/api/ai/tasks/${encodeURIComponent(taskId)}`)));
    server.tool("list_room_members", "Daftar anggota ruangan beserta peran (PIC potensial).", { roomNameOrId: roomNameSchema }, async ({ roomNameOrId }) => asText(await dccFetch(`/api/ai/rooms/members${buildQuery({ roomNameOrId })}`)));
    server.tool("list_pending_task_approvals", "Tugas yang menunggu persetujuan CEO sebelum ditandai selesai.", { limit: limitSchema.describe("Default 20, maks 50") }, async ({ limit }) => asText(await dccFetch(`/api/ai/approvals/tasks${buildQuery({ limit })}`)));
    server.tool("list_pending_pipeline_approvals", "Approval legacy CEO: proyek yang mengajukan pindah tahap enum pipeline (terpisah dari progress milestone).", { limit: limitSchema.describe("Default 20, maks 50") }, async ({ limit }) => asText(await dccFetch(`/api/ai/approvals/pipeline${buildQuery({ limit })}`)));
    server.tool("list_pending_finance_spend", "Pengajuan pengeluaran finance berstatus submitted — menunggu persetujuan.", { limit: limitSchema.describe("Default 20, maks 50") }, async ({ limit }) => asText(await dccFetch(`/api/ai/approvals/finance${buildQuery({ limit })}`)));
    server.tool("get_schedule", "Jadwal umum (meeting/acara) mendatang di DCC.", {
        daysAhead: z
            .number()
            .int()
            .min(1)
            .max(30)
            .optional()
            .describe("Default 7 hari"),
        limit: limitSchema.describe("Default 30, maks 50"),
    }, async ({ daysAhead, limit }) => asText(await dccFetch(`/api/ai/schedule${buildQuery({ daysAhead, limit })}`)));
    server.tool("get_attendance_summary", "Rekap absensi harian: check-in, sakit, izin, estimasi absent.", {
        date: z
            .string()
            .optional()
            .describe("Tanggal YYYY-MM-DD (default hari ini)"),
    }, async ({ date }) => asText(await dccFetch(`/api/ai/attendance/summary${buildQuery({ date })}`)));
    server.tool("get_finance_summary", "Ringkasan finance bulan berjalan: revenue, expense, net, kas, AP/AR overdue.", {
        year: z.number().int().optional().describe("Tahun, mis. 2026"),
        month: z.number().int().min(1).max(12).optional().describe("Bulan 1-12"),
    }, async ({ year, month }) => asText(await dccFetch(`/api/ai/finance/summary${buildQuery({ year, month })}`)));
    server.tool("search_room_wiki", "Cari halaman wiki/catatan keputusan di ruangan DCC (judul & isi).", {
        q: z.string().min(1).describe("Kata kunci pencarian"),
        roomNameOrId: z.string().optional().describe("Batasi ke satu ruangan"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(30)
            .optional()
            .describe("Default 15, maks 30"),
    }, async ({ q, roomNameOrId, limit }) => asText(await dccFetch(`/api/ai/wiki/search${buildQuery({ q, roomNameOrId, limit })}`)));
    server.tool("get_wiki_page", "Baca isi lengkap satu halaman wiki ruangan (by page ID dari search_room_wiki).", {
        pageId: z.string().min(1).describe("ID halaman wiki"),
    }, async ({ pageId }) => asText(await dccFetch(`/api/ai/wiki/pages/${encodeURIComponent(pageId)}`)));
    server.tool("list_room_documents", "Daftar file di Documents & Files ruangan DCC (terbaru dulu). Lanjutkan dengan get_room_document untuk baca isi.", {
        roomNameOrId: z
            .string()
            .optional()
            .describe("Filter satu ruangan (opsional)"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(60)
            .optional()
            .describe("Default 30, maks 60"),
    }, async ({ roomNameOrId, limit }) => asText(await dccFetch(`/api/ai/documents/list${buildQuery({ roomNameOrId, limit })}`)));
    server.tool("search_room_documents", "Cari file di Documents & Files (judul, nama file, tag). Hasil berisi documentId — panggil get_room_document untuk baca isi.", {
        q: z.string().min(1).describe("Kata kunci pencarian"),
        roomNameOrId: z.string().optional().describe("Batasi ke satu ruangan"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(40)
            .optional()
            .describe("Default 20, maks 40"),
    }, async ({ q, roomNameOrId, limit }) => asText(await dccFetch(`/api/ai/documents/search${buildQuery({ q, roomNameOrId, limit })}`)));
    server.tool("get_room_document", "Baca isi teks dokumen upload (PDF, DOCX, TXT, CSV, JSON, HTML). Butuh documentId dari list_room_documents atau search_room_documents.", {
        documentId: z.string().min(1).describe("ID dokumen dari DCC"),
    }, async ({ documentId }) => asText(await dccFetch(`/api/ai/documents/${encodeURIComponent(documentId)}`)));
    const { registerStrategicTools } = await import("./register-strategic-tools.js");
    registerStrategicTools(server, {
        dccFetch,
        buildQuery,
        asText,
        limitSchema,
        roomNameSchema,
    });
    const { registerResearchTools } = await import("./register-research-tools.js");
    registerResearchTools(server, {
        dccFetch,
        buildQuery,
        asText,
        limitSchema,
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("[dcc-mcp] fatal:", err);
    process.exit(1);
});
