import "server-only";

/**
 * Placeholder for multimodal vision analysis.
 * MVP uses image URLs + metadata in LLM text prompts (see guideline-generator).
 */
export async function analyzeBrandVisualSample(_imageUrls: string[]): Promise<{
  dominantMoods: string[];
  colorHints: string[];
}> {
  return { dominantMoods: [], colorHints: [] };
}
