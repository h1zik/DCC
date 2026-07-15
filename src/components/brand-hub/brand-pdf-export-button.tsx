"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/action-error-message";
import { downloadHtmlAsPdf } from "@/lib/research/research-pdf-client";
import { Button } from "@/components/ui/button";

export function BrandPdfExportButton({
  label = "Export PDF",
  fileName,
  getHtml,
}: {
  label?: string;
  fileName: string;
  getHtml: () => Promise<string>;
}) {
  const [pending, startTransition] = useTransition();

  function handleDownload() {
    startTransition(async () => {
      try {
        const html = await getHtml();
        await downloadHtmlAsPdf(fileName, html, fileName);
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
