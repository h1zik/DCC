"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/action-error-message";
import { downloadPdfFromBase64 } from "@/lib/download-file-client";
import { Button } from "@/components/ui/button";

export function BrandPdfExportButton({
  label = "Export PDF",
  fileName,
  getPdfBase64,
}: {
  label?: string;
  fileName: string;
  getPdfBase64: () => Promise<string>;
}) {
  const [pending, startTransition] = useTransition();

  function handleDownload() {
    startTransition(async () => {
      try {
        const base64 = await getPdfBase64();
        downloadPdfFromBase64(base64, fileName);
        toast.success("PDF berhasil diunduh.");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengunduh PDF."));
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleDownload} disabled={pending}>
      <Download className="size-3.5" />
      {label}
    </Button>
  );
}
