import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserCog } from "lucide-react";
import { KolForm } from "@/components/kol-hub/kol-form";
import { LabDetailPage } from "@/components/lab/lab-module-page";
import { canApproveKol } from "@/lib/kol/auth";
import { getKolFormValues, listCategories } from "@/lib/kol/readers";
import { getAccountRates } from "@/lib/kol/rate-context";

export const metadata: Metadata = { title: "Ubah KOL · KOL Hub" };

export default async function EditKolPage({
  params,
}: {
  params: Promise<{ kolId: string }>;
}) {
  const { kolId } = await params;
  const reveal = await canApproveKol();
  const [form, categories] = await Promise.all([
    getKolFormValues(kolId, reveal),
    listCategories(),
  ]);
  if (!form) notFound();
  const rates = await getAccountRates(
    form.values.socialAccounts.map((a) => a.id),
  );
  const rateHints = Object.fromEntries(
    [...rates.entries()].map(([id, r]) => [
      id,
      { band: r.band, medianViews: r.medianViews, tier: r.tier },
    ]),
  );

  return (
    <LabDetailPage
      icon={UserCog}
      backHref={`/kol-hub/kols/${kolId}`}
      title={`Ubah ${form.values.fullName}`}
    >
      <KolForm
        mode="edit"
        kolId={kolId}
        status={form.status}
        initial={form.values}
        masked={form.masked}
        rateHints={rateHints}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </LabDetailPage>
  );
}
