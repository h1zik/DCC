import type { Metadata } from "next";
import { FileSignature } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import { listBrandOptions, listSpkTemplates } from "@/lib/kol/readers";
import { SpkTemplatesClient } from "./spk-templates-client";

export const metadata: Metadata = { title: "Template SPK · KOL Hub" };

export default async function KolSpkTemplatesPage() {
  const [templates, brands] = await Promise.all([listSpkTemplates(), listBrandOptions()]);
  return (
    <LabModulePage
      icon={FileSignature}
      eyebrow="Master data"
      title="Template SPK"
      description="Surat perjanjian kerja sama yang terisi otomatis dari data KOL, campaign, dan jadwal. Dokumen dibekukan saat dibuat, jadi perubahan template tidak mengubah SPK yang sudah terkirim."
    >
      <SpkTemplatesClient templates={templates} brands={brands} />
    </LabModulePage>
  );
}
