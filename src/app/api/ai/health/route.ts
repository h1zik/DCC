import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

/** Cek koneksi token AI tanpa mengekspos data bisnis. */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  return aiApiOk({ status: "ok" }, guard.ctx.role);
}
