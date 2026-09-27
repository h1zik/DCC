import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import { LabStatChip } from "@/components/lab/lab-primitives";
import { canApproveKol, ensureKolHubPage } from "@/lib/kol/auth";
import { listApprovalQueue } from "@/lib/kol/readers";
import { ApprovalsClient } from "./approvals-client";

export const metadata: Metadata = { title: "Approval · KOL Hub" };

export default async function KolApprovalsPage() {
  const { session } = await ensureKolHubPage();
  const [queue, approver] = await Promise.all([listApprovalQueue(), canApproveKol()]);
  const slotCount = queue.orders.reduce((a, o) => a + o.slots.length, 0);

  return (
    <LabModulePage
      icon={Inbox}
      eyebrow="KOL Hub"
      title="Approval"
      description={
        approver
          ? "Putuskan jadwal dan profil KOL yang diajukan tim. Pengajuanmu sendiri harus diputus approver lain."
          : "Antrean pengajuan yang menunggu approver. Kamu bisa memantau, keputusan diambil approver KOL Hub."
      }
      footer={
        <div className="flex flex-wrap gap-2">
          <LabStatChip label="Slot jadwal" value={slotCount} tone={slotCount ? "warning" : "neutral"} />
          <LabStatChip
            label="Profil KOL"
            value={queue.changes.length}
            tone={queue.changes.length ? "warning" : "neutral"}
          />
        </div>
      }
    >
      <ApprovalsClient queue={queue} approver={approver} currentUserId={session.user.id} />
    </LabModulePage>
  );
}
