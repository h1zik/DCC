"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { getReportPdfBase64 } from "@/actions/research-reports";
import { actionErrorMessage } from "@/lib/action-error-message";
import { downloadPdfFromBase64 } from "@/lib/download-file-client";
import { Button } from "@/components/ui/button";

export function ReportPdfDownloadButton({
  reportId,
  title,
}: {
  reportId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDownload() {
    startTransition(async () => {
      try {
        const base64 = await getReportPdfBase64(reportId);
        downloadPdfFromBase64(base64, `research-report-${title}`);
        toast.success("PDF berhasil diunduh.");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengunduh PDF."));
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleDownload} disabled={pending}>
      <Download className="mr-1.5 size-3.5" />
      Export PDF
    </Button>
  );
}
