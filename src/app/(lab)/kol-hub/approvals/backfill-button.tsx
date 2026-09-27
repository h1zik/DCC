"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { backfillKolSpendRequests } from "@/actions/kol-approvals";
import { lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/action-error-message";
import { cn } from "@/lib/utils";

/** Buat pengajuan dana untuk jadwal disetujui yang belum masuk Finance. */
export function BackfillSpendButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className={cn(lab.nestedPanel, "flex flex-wrap items-center justify-between gap-3")}>
      <p className="flex items-center gap-2 text-sm">
        <Landmark className="size-4 shrink-0 text-[var(--lab-accent,var(--primary))]" aria-hidden />
        {count} jadwal sudah disetujui tapi belum punya pengajuan dana di Finance.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const { created } = await backfillKolSpendRequests();
              toast.success(`${created} pengajuan dana dikirim ke Finance.`);
              router.refresh();
            } catch (err) {
              toast.error(actionErrorMessage(err, "Gagal membuat pengajuan dana."));
            }
          })
        }
      >
        Kirim ke Finance
      </Button>
    </div>
  );
}
