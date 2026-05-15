"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { clearAllFinanceDemoData } from "@/actions/finance-demo";
import { Button } from "@/components/ui/button";

export function FinanceClearDemoButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm(
      "Bersihkan semua data finance untuk demo? Tindakan ini menghapus jurnal, AP/AR, budget, bank, kurs, approvals, laporan turunan, dan aset tetap.",
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        await clearAllFinanceDemoData();
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
