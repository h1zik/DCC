"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { clearAllFinanceDemoData } from "@/actions/finance-demo";
import { FINANCE_DEMO_RESET_CONFIRM_PHRASE } from "@/lib/finance-demo-policy";
import { Button } from "@/components/ui/button";

export function FinanceClearDemoButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const typed = window.prompt(
      "Tindakan ini menghapus SEMUA data finance: jurnal, AP/AR, budget, bank, kurs, approvals, dan aset tetap.\n\n" +
        `Ketik "${FINANCE_DEMO_RESET_CONFIRM_PHRASE}" untuk melanjutkan.`,
    );
    if (typed === null) return;

    startTransition(async () => {
      try {
        await clearAllFinanceDemoData(typed);
        toast.success("Semua data finance demo berhasil dibersihkan.");
        router.refresh();
      } catch (err) {
        toast.error(
          actionErrorMessage(err, "Gagal membersihkan data finance."));
      }
    });
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={onClick}
    >
      Bersihkan
    </Button>
  );
}
