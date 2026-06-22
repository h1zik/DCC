/** Client-safe types for Brand Portfolio. */

export type BrandPortfolioLineRole =
  | "HERO"
  | "CORE"
  | "FLANKER"
  | "EXPERIMENTAL";

export type BrandPortfolioLineInput = {
  id?: string;
  name: string;
  category?: string | null;
  description?: string | null;
  targetAudience?: string | null;
  role?: BrandPortfolioLineRole | null;
  productDiscoveryQueryId?: string | null;
  sortOrder?: number;
};

export type BrandPortfolioLineView = BrandPortfolioLineInput & {
  id: string;
  sortOrder: number;
  productDiscoveryLabel?: string | null;
};

export type BrandPortfolioView = {
  id: string;
  brandId: string;
  brandName: string;
  summary: string | null;
  lines: BrandPortfolioLineView[];
  updatedAt: string;
};

export type ProductDiscoveryOption = {
  id: string;
  label: string;
  detail?: string;
  status: string;
};

export type ProductLineStrategy = {
  lineId?: string;
  lineName: string;
  role?: string;
  category?: string;
  positioning: string;
  keyMessage: string;
  differentiator: string;
  targetAudience?: string;
  portfolioFit?: string;
};
