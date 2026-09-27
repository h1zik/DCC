import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { KolForm } from "@/components/kol-hub/kol-form";
import { EMPTY_KOL_FORM } from "@/lib/kol/form-defaults";
import { LabDetailPage } from "@/components/lab/lab-module-page";
import { getInfluencerPrefill, listCategories } from "@/lib/kol/readers";

export const metadata: Metadata = { title: "Tambah KOL · KOL Hub" };

export default async function NewKolPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const [categories, prefill] = await Promise.all([
    listCategories(),
    from ? getInfluencerPrefill(from) : Promise.resolve(null),
  ]);
  // Akun dari Radar/Audit yang sudah terdaftar → langsung ke profilnya.
  if (prefill?.existingKolId) redirect(`/kol-hub/kols/${prefill.existingKolId}`);

  const initial = prefill
    ? {
        ...EMPTY_KOL_FORM,
        fullName: prefill.displayName ?? "",
        socialAccounts: [
          { platform: prefill.platform, handle: prefill.handle, rateCard: "" },
        ],
      }
    : EMPTY_KOL_FORM;

  return (
    <LabDetailPage
      icon={UserPlus}
      backHref="/kol-hub/kols"
      title="Tambah KOL"
      description={
        prefill
          ? `Diambil dari Brand Hub: @${prefill.handle}. Lengkapi data lalu ajukan — KOL bisa dijadwalkan setelah disetujui approver.`
          : "KOL baru masuk antrean approval. Setelah disetujui, KOL bisa dijadwalkan."
      }
    >
      <KolForm
        mode="create"
        initial={initial}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </LabDetailPage>
  );
}
