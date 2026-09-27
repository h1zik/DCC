import type { Metadata } from "next";
import { CalendarPlus } from "lucide-react";
import { ScheduleBuilder } from "@/components/kol-hub/schedule-builder";
import { LabDetailPage } from "@/components/lab/lab-module-page";
import { ensureKolHubPage } from "@/lib/kol/auth";
import { getAccountRates } from "@/lib/kol/rate-context";
import {
  listBrandOptions,
  listBriefs,
  listBudgets,
  listCampaigns,
  listEndorseTypes,
  listProductsForPricing,
  listSchedulableKols,
  listUserOptions,
} from "@/lib/kol/readers";

export const metadata: Metadata = { title: "Buat jadwal · KOL Hub" };

export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ kol?: string; campaign?: string }>;
}) {
  const { session } = await ensureKolHubPage();
  const sp = await searchParams;
  const [brands, campaigns, budgets, kols, endorseTypes, briefs, products, users] =
    await Promise.all([
      listBrandOptions(),
      listCampaigns(),
      listBudgets(),
      listSchedulableKols(),
      listEndorseTypes(),
      listBriefs(),
      listProductsForPricing(),
      listUserOptions(),
    ]);

  const preCampaign = campaigns.find((c) => c.id === sp.campaign);
  const rates = await getAccountRates(kols.flatMap((k) => k.accounts.map((a) => a.id)));
  const rateHints = Object.fromEntries(
    [...rates.entries()].map(([id, r]) => [
      id,
      { band: r.band, medianViews: r.medianViews, tier: r.tier },
    ]),
  );

  return (
    <LabDetailPage
      icon={CalendarPlus}
      backHref="/kol-hub/schedules"
      title="Buat jadwal endorsement"
      description="Pilih brand, campaign, dan KOL sekali — lalu tambahkan satu slot untuk setiap konten. Tiap slot jadi jadwal sendiri dengan nomornya sendiri."
    >
      <ScheduleBuilder
        currentUserId={session.user.id}
        initialBrandId={preCampaign?.brandId ?? ""}
        initialCampaignId={preCampaign?.id ?? ""}
        initialKolId={kols.some((k) => k.id === sp.kol) ? (sp.kol ?? "") : ""}
        brands={brands}
        campaigns={campaigns.map((c) => ({
          id: c.id,
          title: c.title,
          brandId: c.brandId,
          budgetId: c.budgetId,
        }))}
        budgets={budgets.map((b) => ({
          id: b.id,
          name: b.name,
          beginning: b.beginning,
          committed: b.committed,
          pending: b.pending,
        }))}
        kols={kols}
        endorseTypes={endorseTypes.map((t) => ({ id: t.id, name: t.name, isBarter: t.isBarter }))}
        briefs={briefs.map((b) => ({ id: b.id, title: b.title, brandId: b.brandId }))}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          brandId: p.brandId,
          retailPrice: p.retailPrice,
        }))}
        users={users}
        rateHints={rateHints}
      />
    </LabDetailPage>
  );
}
