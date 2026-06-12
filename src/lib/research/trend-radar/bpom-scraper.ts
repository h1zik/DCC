import "server-only";

export type BpomTrendSignal = {
  term: string;
  source: string;
  productName?: string;
};

/** Placeholder MVP — data BPOM publik membutuhkan scraper khusus. */
export async function fetchBpomTrendSignals(): Promise<BpomTrendSignal[]> {
  return [
    {
      term: "exosome serum",
      source: "bpom_demo",
      productName: "Exosome Brightening Serum",
    },
    {
      term: "barrier cream ceramide",
      source: "bpom_demo",
      productName: "Ceramide Barrier Repair Cream",
    },
    {
      term: "tinted sunscreen",
      source: "bpom_demo",
      productName: "UV Shield Tinted Sunscreen SPF50",
    },
  ];
}
