import { aiGetCompanyRisks } from "@/lib/ai-api/strategic-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/**
 * Rollup risiko perusahaan terprioritas (read-only) untuk integrasi MCP.
 * Menggabungkan overdue, blocked, stuck projects, stok kritis, AP/AR overdue,
 * dan approval menua ke dalam satu daftar terurut severity.
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;
  return aiApiOk(await aiGetCompanyRisks(guard.ctx.role), guard.ctx.role);
}
