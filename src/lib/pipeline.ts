import { PipelineStage } from "@prisma/client";

/** Urutan kolom pipeline (proyek & produk). */
export const PIPELINE_ORDER: PipelineStage[] = [
  PipelineStage.MARKET_RESEARCH,
  PipelineStage.PRODUCT_DEVELOPMENT,
  PipelineStage.BRAND_AND_DESIGN,
  PipelineStage.PANEL_TESTING,
  PipelineStage.PRODUCTION,
  PipelineStage.PRELAUNCH,
  PipelineStage.LAUNCH,
];

export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  MARKET_RESEARCH: "Market Research",
  PRODUCT_DEVELOPMENT: "Product Development",
  BRAND_AND_DESIGN: "Brand & Design",
  PANEL_TESTING: "Panel Testing",
  PRODUCTION: "Production",
  PRELAUNCH: "Prelaunch",
  LAUNCH: "Launch",
};
