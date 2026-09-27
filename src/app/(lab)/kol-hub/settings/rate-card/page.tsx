import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import { canApproveKol } from "@/lib/kol/auth";
import { getKolRateSettings } from "@/lib/kol/rate-context";
import { getLatestKolSyncRun } from "@/lib/kol/post-sync";
import { RateCardClient } from "./rate-card-client";

export const metadata: Metadata = { title: "Rate card & FYP · KOL Hub" };

export default async function KolRateCardPage() {
  const [settings, approver, lastRun] = await Promise.all([
    getKolRateSettings(),
    canApproveKol(),
    getLatestKolSyncRun(),
  ]);
  return (
    <LabModulePage
      icon={Scale}
      eyebrow="Master data"
      title="Rate card & FYP"
      description="Harga wajar KOL = median views ÷ 1.000 × CPM acuan untuk tier & platform-nya. Rate yang diajukan dibandingkan dengan rentang ini."
    >
      <RateCardClient
        settings={settings}
        canEdit={approver}
        lastRun={
          lastRun
            ? {
                status: lastRun.status,
                createdAt: lastRun.createdAt.toISOString(),
                updated: lastRun.updated,
                missing: lastRun.missing,
                error: lastRun.error,
              }
            : null
        }
      />
    </LabModulePage>
  );
}
