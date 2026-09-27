import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import {
  listBrandOptions,
  listBudgets,
  listCampaigns,
  listUserOptions,
} from "@/lib/kol/readers";
import { CampaignsClient } from "./campaigns-client";

export const metadata: Metadata = { title: "Campaign · KOL Hub" };

export default async function KolCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand } = await searchParams;
  const [campaigns, brands, budgets, users] = await Promise.all([
    listCampaigns(brand || null),
    listBrandOptions(),
    listBudgets(),
    listUserOptions(),
  ]);

  return (
    <LabModulePage
      icon={Megaphone}
      eyebrow="KOL Hub"
      title="Campaign"
      description="Setiap campaign punya satu brand dan satu budget. Jadwal KOL selalu masuk ke sebuah campaign."
    >
      <CampaignsClient
        campaigns={campaigns}
        brands={brands}
        budgets={budgets.map((b) => ({
          id: b.id,
          name: b.name,
          brandId: b.brandId,
          remaining: b.remaining,
        }))}
        users={users}
      />
    </LabModulePage>
  );
}
