import { aiEvaluateProductProposal } from "@/lib/ai-api/research-queries";
import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiOk } from "@/lib/ai-api/response";

export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const productQuery = params.get("productQuery")?.trim();
  if (!productQuery) {
    return aiApiOk(
      {
        accessible: false,
        message: "Parameter productQuery wajib, mis. body lotion.",
        data: null,
      },
      guard.ctx.role,
    );
  }

  const proposedPriceRaw = params.get("proposedPrice");
  const proposedPrice = proposedPriceRaw
    ? Number(proposedPriceRaw.replace(/[^\d]/g, ""))
    : undefined;

  return aiApiOk(
    await aiEvaluateProductProposal(guard.ctx.role, {
      productQuery,
      proposedPrice:
        proposedPrice != null && Number.isFinite(proposedPrice)
          ? proposedPrice
          : undefined,
      claims: params.get("claims")?.trim() || undefined,
      sizeMl: params.get("sizeMl")
        ? Number(params.get("sizeMl"))
        : undefined,
      packagingNotes: params.get("packagingNotes")?.trim() || undefined,
    }),
    guard.ctx.role,
  );
}
