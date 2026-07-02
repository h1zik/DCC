import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type Deps = {
  dccFetch: (path: string) => Promise<unknown>;
  buildQuery: (params: Record<string, string | number | undefined>) => string;
  asText: (data: unknown) => {
    content: { type: "text"; text: string }[];
  };
  limitSchema: z.ZodOptional<z.ZodNumber>;
  roomNameSchema: z.ZodString;
};

export function registerStrategicTools(server: McpServer, deps: Deps) {
  const { dccFetch, buildQuery, asText, limitSchema, roomNameSchema } = deps;

  server.tool(
    "get_company_executive_briefing",
    "Snapshot holistik kondisi perusahaan: KPI, overdue, approval, pipeline, stok kritis, outgoing sales, finance pulse, absensi.",
    {},
    async () => asText(await dccFetch("/api/ai/executive/briefing")),
  );

  server.tool(
    "get_sales_outgoing_by_brand",
    "Outgoing PCS per brand (sales + sampling) dalam N hari terakhir.",
    {
      days: z
        .number()
        .int()
        .min(7)
        .max(365)
        .optional()
        .describe("Default 90 hari"),
    },
    async ({ days }) =>
      asText(
        await dccFetch(
          `/api/ai/commercial/outgoing-by-brand${buildQuery({ days })}`,
        ),
      ),
  );

  server.tool(
    "list_brands",
    "Daftar brand aktif beserta jumlah produk, proyek, dan ruangan.",
    {},
    async () => asText(await dccFetch("/api/ai/brands")),
  );

  server.tool(
    "list_projects_by_pipeline_stage",
    "Daftar proyek brand dengan progress milestone (milestone utama selesai ÷ total). Termasuk milestone aktif dan grouping per tahap saat ini.",
    {},
    async () => asText(await dccFetch("/api/ai/projects/by-stage")),
  );

  server.tool(
    "get_project_detail",
    "Detail proyek: pohon milestone, progress %, milestone aktif, tugas terbuka. Field legacyStageApproval hanya untuk approval CEO enum lama.",
    {
      projectId: z.string().min(1),
    },
    async ({ projectId }) =>
      asText(
        await dccFetch(
          `/api/ai/projects/${encodeURIComponent(projectId)}`,
        ),
      ),
  );

  server.tool(
    "list_stuck_projects",
    "Proyek dengan milestone terhambat (BLOCKED) atau milestone berjalan tanpa update lama (default ≥45 hari).",
    {
      minDaysInStage: z
        .number()
        .int()
        .min(7)
        .max(365)
        .optional()
        .describe("Hari tanpa update milestone berjalan (default 45)"),
    },
    async ({ minDaysInStage }) =>
      asText(
        await dccFetch(
          `/api/ai/projects/stuck${buildQuery({ minDaysInStage })}`,
        ),
      ),
  );

  server.tool(
    "list_products",
    "Katalog SKU dengan stok, min stok, dan health status.",
    {
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ limit }) =>
      asText(await dccFetch(`/api/ai/products${buildQuery({ limit })}`)),
  );

  server.tool(
    "list_vendors",
    "Daftar vendor maklon / supplier.",
    { limit: limitSchema },
    async ({ limit }) =>
      asText(await dccFetch(`/api/ai/vendors${buildQuery({ limit })}`)),
  );

  server.tool(
    "get_ap_ar_aging",
    "Piutang & hutang outstanding: overdue, due soon, top items.",
    {},
    async () => asText(await dccFetch("/api/ai/finance/ap-ar-aging")),
  );

  server.tool(
    "get_budget_vs_actual",
    "Budget vs aktual beban per bulan (variance per baris budget).",
    {
      year: z.number().int().optional(),
      month: z.number().int().min(1).max(12).optional(),
    },
    async ({ year, month }) =>
      asText(
        await dccFetch(
          `/api/ai/finance/budget-vs-actual${buildQuery({ year, month })}`,
        ),
      ),
  );

  server.tool(
    "get_blocked_tasks_summary",
    "Semua tugas berstatus BLOCKED lintas ruangan.",
    { limit: limitSchema },
    async ({ limit }) =>
      asText(
        await dccFetch(`/api/ai/tasks/blocked${buildQuery({ limit })}`),
      ),
  );

  server.tool(
    "get_attendance_weekly_trend",
    "Trend kehadiran 7 hari: check-in, sakit, izin, estimasi absent.",
    {},
    async () => asText(await dccFetch("/api/ai/attendance/weekly-trend")),
  );

  server.tool(
    "list_org_users",
    "Daftar pengguna organisasi (nama, email, role). Untuk jumlah/judul tugas per user pakai get_users_task_overview atau get_user_tasks.",
    {
      limit: z.number().int().min(1).max(80).optional(),
    },
    async ({ limit }) =>
      asText(await dccFetch(`/api/ai/org/users${buildQuery({ limit })}`)),
  );

  server.tool(
    "get_content_plan_status",
    "Status content planning per ruangan brand (copywriting & design).",
    {
      roomNameOrId: z.string().optional().describe("Filter satu ruangan"),
    },
    async ({ roomNameOrId }) =>
      asText(
        await dccFetch(
          `/api/ai/content-plan/status${buildQuery({ roomNameOrId })}`,
        ),
      ),
  );

  server.tool(
    "get_mcp_capabilities",
    "Daftar modul DCC yang bisa diakses dengan role MCP saat ini.",
    {},
    async () => asText(await dccFetch("/api/ai/meta/capabilities")),
  );

  server.tool(
    "get_company_risks",
    "Rollup risiko perusahaan TERURUT severity dalam satu daftar — 'apa yang perlu perhatian sekarang'. Gabungan overdue, tugas blocked, proyek macet, stok kritis, AP/AR overdue, dan approval menua. Tool utama untuk 'apa yang genting', 'ada masalah apa', 'kondisi risiko'.",
    {},
    async () => asText(await dccFetch("/api/ai/risks")),
  );

  server.tool(
    "get_brand_overview",
    "Dossier 360 satu brand: proyek + progress milestone, kesehatan tugas per status, stok SKU brand (kritis/rendah), outgoing sales 90 hari, dan ringkasan content plan. Tool utama untuk 'gimana kondisi brand X', 'overview brand', 'brand X sehat tidak'.",
    {
      brandNameOrId: z
        .string()
        .min(1)
        .describe('Nama atau ID brand, mis. "Dominatus"'),
    },
    async ({ brandNameOrId }) =>
      asText(
        await dccFetch(
          `/api/ai/brands/overview${buildQuery({ brandNameOrId })}`,
        ),
      ),
  );

  server.tool(
    "get_recent_activity",
    "Change feed lintas modul — 'apa yang bergerak' N hari terakhir: tugas dibuat/selesai, milestone selesai/terhambat, dokumen baru, pergerakan stok, jadwal, jurnal finance. Tool utama untuk 'apa yang terjadi belakangan', 'update terbaru', 'aktivitas minggu ini'.",
    {
      days: z
        .number()
        .int()
        .min(1)
        .max(30)
        .optional()
        .describe("Jendela hari ke belakang (default 7, maks 30)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(80)
        .optional()
        .describe("Maks event dikembalikan (default 40, maks 80)"),
    },
    async ({ days, limit }) =>
      asText(
        await dccFetch(`/api/ai/activity${buildQuery({ days, limit })}`),
      ),
  );
}
