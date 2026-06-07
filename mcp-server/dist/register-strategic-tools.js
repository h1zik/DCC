import { z } from "zod";
export function registerStrategicTools(server, deps) {
    const { dccFetch, buildQuery, asText, limitSchema, roomNameSchema } = deps;
    server.tool("get_company_executive_briefing", "Snapshot holistik kondisi perusahaan: KPI, overdue, approval, pipeline, stok kritis, outgoing sales, finance pulse, absensi.", {}, async () => asText(await dccFetch("/api/ai/executive/briefing")));
    server.tool("get_sales_outgoing_by_brand", "Outgoing PCS per brand (sales + sampling) dalam N hari terakhir.", {
        days: z
            .number()
            .int()
            .min(7)
            .max(365)
            .optional()
            .describe("Default 90 hari"),
    }, async ({ days }) => asText(await dccFetch(`/api/ai/commercial/outgoing-by-brand${buildQuery({ days })}`)));
    server.tool("list_brands", "Daftar brand aktif beserta jumlah produk, proyek, dan ruangan.", {}, async () => asText(await dccFetch("/api/ai/brands")));
    server.tool("list_projects_by_pipeline_stage", "Proyek brand dikelompokkan per tahap pipeline (Market Research → Launch).", {}, async () => asText(await dccFetch("/api/ai/projects/by-stage")));
    server.tool("get_project_detail", "Detail proyek: stage, milestone progress, tugas aktif.", {
        projectId: z.string().min(1),
    }, async ({ projectId }) => asText(await dccFetch(`/api/ai/projects/${encodeURIComponent(projectId)}`)));
    server.tool("list_stuck_projects", "Proyek brand yang lama di tahap pipeline yang sama (potensi bottleneck).", {
        minDaysInStage: z
            .number()
            .int()
            .min(7)
            .max(365)
            .optional()
            .describe("Default 45 hari"),
    }, async ({ minDaysInStage }) => asText(await dccFetch(`/api/ai/projects/stuck${buildQuery({ minDaysInStage })}`)));
    server.tool("list_products", "Katalog SKU dengan stok, min stok, dan health status.", {
        limit: z.number().int().min(1).max(100).optional(),
    }, async ({ limit }) => asText(await dccFetch(`/api/ai/products${buildQuery({ limit })}`)));
    server.tool("list_vendors", "Daftar vendor maklon / supplier.", { limit: limitSchema }, async ({ limit }) => asText(await dccFetch(`/api/ai/vendors${buildQuery({ limit })}`)));
    server.tool("get_ap_ar_aging", "Piutang & hutang outstanding: overdue, due soon, top items.", {}, async () => asText(await dccFetch("/api/ai/finance/ap-ar-aging")));
    server.tool("get_budget_vs_actual", "Budget vs aktual beban per bulan (variance per baris budget).", {
        year: z.number().int().optional(),
        month: z.number().int().min(1).max(12).optional(),
    }, async ({ year, month }) => asText(await dccFetch(`/api/ai/finance/budget-vs-actual${buildQuery({ year, month })}`)));
    server.tool("get_blocked_tasks_summary", "Semua tugas berstatus BLOCKED lintas ruangan.", { limit: limitSchema }, async ({ limit }) => asText(await dccFetch(`/api/ai/tasks/blocked${buildQuery({ limit })}`)));
    server.tool("get_team_workload_summary", "PIC dengan beban tugas/overdue tertinggi (sampel tugas aktif).", { limit: limitSchema }, async ({ limit }) => asText(await dccFetch(`/api/ai/team/workload${buildQuery({ limit })}`)));
    server.tool("get_attendance_weekly_trend", "Trend kehadiran 7 hari: check-in, sakit, izin, estimasi absent.", {}, async () => asText(await dccFetch("/api/ai/attendance/weekly-trend")));
    server.tool("list_org_users", "Daftar pengguna organisasi (nama, email, role) — read-only.", {
        limit: z.number().int().min(1).max(80).optional(),
    }, async ({ limit }) => asText(await dccFetch(`/api/ai/org/users${buildQuery({ limit })}`)));
    server.tool("get_content_plan_status", "Status content planning per ruangan brand (copywriting & design).", {
        roomNameOrId: z.string().optional().describe("Filter satu ruangan"),
    }, async ({ roomNameOrId }) => asText(await dccFetch(`/api/ai/content-plan/status${buildQuery({ roomNameOrId })}`)));
    server.tool("get_mcp_capabilities", "Daftar modul DCC yang bisa diakses dengan role MCP saat ini.", {}, async () => asText(await dccFetch("/api/ai/meta/capabilities")));
}
