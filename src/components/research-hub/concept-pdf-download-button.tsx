"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { getMaklonBriefHtml } from "@/actions/research-concept-lab";
import { actionErrorMessage } from "@/lib/action-error-message";
import { downloadHtmlAsPdf } from "@/lib/research/research-pdf-client";
import { Button } from "@/components/ui/button";

export function ConceptPdfDownloadButton({
  conceptId,
  title,
}: {
  conceptId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDownload() {
    startTransition(async () => {
      try {
        const html = await getMaklonBriefHtml(conceptId);
        await downloadHtmlAsPdf(title, html, `maklon-brief-${title}`);
        toast.success("PDF berhasil diunduh.");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengunduh PDF."));
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleDownload} disabled={pending}>
      <Download className="mr-1.5 size-3.5" />
      Export PDF Maklon Brief
    </Button>
  );
}
