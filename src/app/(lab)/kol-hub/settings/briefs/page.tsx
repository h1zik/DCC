import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import { listBrandOptions, listBriefs, listCategories } from "@/lib/kol/readers";
import { BriefsClient } from "./briefs-client";

export const metadata: Metadata = { title: "Brief · KOL Hub" };

export default async function KolBriefsPage() {
  const [briefs, brands, categories] = await Promise.all([
    listBriefs(),
    listBrandOptions(),
    listCategories(),
  ]);
  return (
    <LabModulePage
      icon={FileText}
      eyebrow="Master data"
      title="Brief kreatif"
      description="Arahan konten per brand. Satu brief bisa dipakai banyak jadwal; tautkan dokumen lengkapnya (Google Docs, Drive, Notion)."
    >
      <BriefsClient
        briefs={briefs}
        brands={brands}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </LabModulePage>
  );
}
