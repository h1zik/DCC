import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import { canApproveKol } from "@/lib/kol/auth";
import { listBrandOptions, listBudgets } from "@/lib/kol/readers";
import { BudgetsClient } from "./budgets-client";

export const metadata: Metadata = { title: "Budget · KOL Hub" };

export default async function KolBudgetsPage() {
  const [budgets, brands, approver] = await Promise.all([
    listBudgets(),
    listBrandOptions(),
    canApproveKol(),
  ]);
  return (
    <LabModulePage
      icon={Wallet}
      eyebrow="Master data"
      title="Budget endorsement"
      description="Pos anggaran per brand. Terpakai dihitung dari jadwal yang diajukan, disetujui, dan tayang — jadwal batal atau ditolak mengembalikan budget."
    >
      <BudgetsClient budgets={budgets} brands={brands} canEdit={approver} />
    </LabModulePage>
  );
}
