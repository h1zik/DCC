import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import { listCategories, listEndorseTypes } from "@/lib/kol/readers";
import { TaxonomyClient } from "./taxonomy-client";

export const metadata: Metadata = { title: "Kategori & jenis endorse · KOL Hub" };

export default async function KolTaxonomyPage() {
  const [categories, types] = await Promise.all([
    listCategories({ includeArchived: true }),
    listEndorseTypes({ includeArchived: true }),
  ]);
  return (
    <LabModulePage
      icon={Tags}
      eyebrow="Master data"
      title="Kategori & jenis endorse"
      description="Kategori mengelompokkan KOL berdasarkan niche. Jenis endorse menentukan bentuk bayaran — jenis barter selalu ber-rate 0."
    >
      <TaxonomyClient categories={categories} types={types} />
    </LabModulePage>
  );
}
