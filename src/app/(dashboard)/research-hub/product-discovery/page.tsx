import { PackageSearch } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
import { resumeStuckProductDiscoveryJobs } from "@/lib/research/run-product-discovery-job";
import {
  ProductDiscoveryClient,
  type ProductDiscoveryQueryRow,
} from "./product-discovery-client";

export default async function ProductDiscoveryPage() {
  try {
    await resumeStuckProductDiscoveryJobs(3);
  } catch (err) {
    console.error("[ProductDiscoveryPage] resume jobs:", err);
  }

  const queries = await prisma.productDiscoveryQuery.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const rows: ProductDiscoveryQueryRow[] = queries.map((q) => ({
    id: q.id,
    keyword: q.keyword,
    marketplaces: q.marketplaces,
    productLimit: q.productLimit,
    status: q.status,
    productCount: q.productCount,
    errorMessage: q.errorMessage,
    createdAt: q.createdAt.toISOString(),
  }));

  return (
    <ResearchHubModulePage
      icon={PackageSearch}
      title="Product Discovery"
      description="Tarik daftar produk kompetitor dari keyword — puluhan produk dari berbagai brand/toko sekaligus."
    >
      <ProductDiscoveryClient queries={rows} />
    </ResearchHubModulePage>
  );
}
