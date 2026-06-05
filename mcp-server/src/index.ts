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

async function dccFetch(path: string): Promise<unknown> {
  const res = await fetch(`${DCC_AI_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${DCC_AI_READ_API_TOKEN}`,
      "x-dcc-role": DCC_AI_ROLE,
      Accept: "application/json",
    },
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      typeof body.error === "string" ? body.error : `HTTP ${res.status}`;
    throw new Error(`DCC API error: ${err}`);
  }
  return body;
}

function asText(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

async function main() {
  requireConfig();

  const server = new McpServer({
    name: "dcc-read-api",
    version: "1.0.0",
  });

  server.tool(
    "get_kpi_overview",
    "Ringkasan KPI operasional Dominatus Control Center: tugas overdue, stok kritis, persetujuan pending.",
    {},
    async () => asText(await dccFetch("/api/ai/kpi-overview")),
  );

  server.tool(
    "get_overdue_tasks",
    "Daftar tugas yang sudah melewati tenggat (overdue) beserta assignee dan konteks proyek/ruangan.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Jumlah maksimal baris (default 20, maks 50)"),
    },
    async ({ limit }) => {
      const q = typeof limit === "number" ? `?limit=${limit}` : "";
      return asText(await dccFetch(`/api/ai/tasks/overdue${q}`));
    },
  );

  server.tool(
    "get_inventory_alerts",
    "SKU dengan stok rendah atau kritis yang perlu perhatian logistik.",
    {
      severity: z
        .enum(["all", "critical", "low"])
        .optional()
        .describe("Filter tingkat: all (default), critical, atau low"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Jumlah maksimal baris (default 30, maks 50)"),
    },
    async ({ severity, limit }) => {
      const params = new URLSearchParams();
      if (severity) params.set("severity", severity);
      if (typeof limit === "number") params.set("limit", String(limit));
      const q = params.size > 0 ? `?${params.toString()}` : "";
      return asText(await dccFetch(`/api/ai/inventory/alerts${q}`));
    },
  );

  server.tool(
    "dcc_health_check",
    "Cek koneksi token ke DCC Railway tanpa mengekspos data bisnis.",
    {},
    async () => asText(await dccFetch("/api/ai/health")),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[dcc-mcp] fatal:", err);
  process.exit(1);
});
