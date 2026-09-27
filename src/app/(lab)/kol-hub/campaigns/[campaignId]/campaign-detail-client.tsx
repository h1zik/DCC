"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, Pencil } from "lucide-react";
import { toast } from "sonner";
import { archiveKolCampaign } from "@/actions/kol-master";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CampaignDialog, type CampaignFormValue } from "@/components/kol-hub/campaign-dialog";
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/action-error-message";

export function CampaignDetailActions({
  campaign,
  brands,
  budgets,
  users,
}: {
  campaign: CampaignFormValue & { id: string };
  brands: { id: string; name: string }[];
  budgets: { id: string; name: string; brandId: string; remaining: number }[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil />
        Ubah
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setArchiveOpen(true)}>
        <Archive />
        Arsipkan
      </Button>
      {editOpen ? (
        <CampaignDialog
          open
          onOpenChange={setEditOpen}
          initial={campaign}
          brands={brands}
          budgets={budgets}
          users={users}
        />
      ) : null}
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Arsipkan campaign ini?"
        description="Campaign yang diarsipkan tidak muncul lagi di pilihan schedule builder. Riwayat jadwalnya tetap tersimpan."
        confirmLabel="Arsipkan"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            try {
              await archiveKolCampaign(campaign.id);
              toast.success("Campaign diarsipkan.");
              router.push("/kol-hub/campaigns");
              router.refresh();
            } catch (err) {
              toast.error(actionErrorMessage(err, "Gagal mengarsipkan campaign."));
            }
          })
        }
      />
    </>
  );
}
