export type VisualLibraryAssetView = {
  id: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  sourceUrl: string | null;
  tags: string[];
  createdAt: string;
};

export type VisualLibraryGroups = {
  pinterest: {
    collection: {
      id: string;
      name: string;
      keywords: string[];
      status: string;
      assetCount: number;
      errorMessage: string | null;
      maxPinsPerKeyword: number | null;
      dataProvenance: import("@/lib/research/scrape-data-provider").DataProvenanceEntry[];
    };
    assets: VisualLibraryAssetView[];
  }[];
  competitors: {
    competitorId: string;
    name: string;
    assets: VisualLibraryAssetView[];
  }[];
  competitorProducts: {
    categoryId: string;
    name: string;
    assets: VisualLibraryAssetView[];
  }[];
  socialMonitors: {
    monitorId: string;
    name: string;
    assets: VisualLibraryAssetView[];
  }[];
  manual: VisualLibraryAssetView[];
};
