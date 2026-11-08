/** Bentuk JSON `aiInsights` hasil analisis Product Discovery. */
export type DiscoveryInsights = {
  summary?: string | null;
  priceStats?: { min: number; max: number; avg: number; median: number } | null;
  priceBands?: {
    label: string;
    count: number;
    avgRating: number;
    avgSold: number;
  }[];
  valueLeaders?: { name: string; rating: number; price: number }[];
  promoShare?: number;
  bubble?: {
    name: string;
    price: number;
    rating: number;
    sold: number;
    marketplace: string;
  }[];
  brandBreakdown?: DiscoveryBrandRow[];
};

export type DiscoveryBrandRow = {
  shopName: string;
  productCount: number;
  avgRating: number;
  totalSold: number;
  marketplaces: string[];
};
